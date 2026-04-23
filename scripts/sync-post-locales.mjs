import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "yaml";

const BLOG_DIR = path.resolve(process.cwd(), "src/data/blog");
const CHECK_ONLY = process.argv.includes("--check");

const SHARED_FIELDS = [
  "translationKey",
  "pubDatetime",
  "featured",
  "draft",
  "tags",
];

const CJK_MIN_RATIO = 0.4;

async function walkMarkdownFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith("_")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdownFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(full);
    }
  }
  return files.sort();
}

function splitFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("expected markdown file with YAML frontmatter");
  }
  return { rawFrontmatter: match[1], body: match[2] };
}

function parseFrontmatter(source) {
  const { rawFrontmatter, body } = splitFrontmatter(source);
  const data = YAML.parse(rawFrontmatter) ?? {};
  return { data, body };
}

function serialize(data, body) {
  const fm = YAML.stringify(data, { lineWidth: 0 }).trimEnd();
  return `---\n${fm}\n---\n${body}`;
}

function inferLocale(filePath) {
  return filePath.endsWith(".cn.md") ? "cn" : "en";
}

function inferTranslationKey(filePath) {
  return path.basename(filePath, ".md").replace(/\.cn$/, "");
}

function counterpartPath(filePath, sourceLocale) {
  return sourceLocale === "cn"
    ? filePath.replace(/\.cn\.md$/, ".md")
    : filePath.replace(/\.md$/, ".cn.md");
}

function normalizeData(data, locale, translationKey) {
  const next = { ...data };
  next.locale = locale;
  next.translationKey = translationKey;
  if (locale === "cn") delete next.slug;
  return next;
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ak = Object.keys(a).sort();
    const bk = Object.keys(b).sort();
    if (ak.length !== bk.length) return false;
    if (ak.some((k, i) => k !== bk[i])) return false;
    return ak.every(k => deepEqual(a[k], b[k]));
  }
  return false;
}

function stripCodeAndLinks(body) {
  return body
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]*`/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\]\([^)]*\)/g, "]");
}

function cjkRatio(body) {
  const stripped = stripCodeAndLinks(body);
  const cjk = (stripped.match(/[一-鿿㐀-䶿]/g) || []).length;
  const latinWords = (stripped.match(/[A-Za-z]{3,}/g) || []).length;
  if (cjk + latinWords === 0) return 1;
  return cjk / (cjk + latinWords);
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function writeIfChanged(p, contents) {
  const exists = await fileExists(p);
  const current = exists ? await fs.readFile(p, "utf8") : null;
  if (current === contents) return { changed: false, created: false };
  if (!CHECK_ONLY) {
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, contents, "utf8");
  }
  return { changed: true, created: !exists };
}

const files = await walkMarkdownFiles(BLOG_DIR);
const groups = new Map();

for (const filePath of files) {
  const locale = inferLocale(filePath);
  const translationKey = inferTranslationKey(filePath);
  const source = await fs.readFile(filePath, "utf8");
  const { data, body } = parseFrontmatter(source);
  const current = groups.get(translationKey) ?? {};
  current[locale] = { filePath, data, body };
  groups.set(translationKey, current);
}

const changes = [];
const errors = [];
const rel = p => path.relative(process.cwd(), p);

for (const [translationKey, pair] of groups.entries()) {
  for (const locale of ["en", "cn"]) {
    const existing = pair[locale];
    if (!existing) continue;
    const normalized = normalizeData(existing.data, locale, translationKey);
    if (!deepEqual(existing.data, normalized)) {
      const serialized = serialize(normalized, existing.body);
      const { changed } = await writeIfChanged(existing.filePath, serialized);
      if (changed) {
        changes.push(
          `${CHECK_ONLY ? "would normalize" : "normalized"} ${rel(existing.filePath)}`
        );
      }
      existing.data = normalized;
    }
  }

  for (const locale of ["en", "cn"]) {
    if (pair[locale]) continue;
    const sourceLocale = locale === "en" ? "cn" : "en";
    const src = pair[sourceLocale];
    if (!src) continue;
    const targetPath = counterpartPath(src.filePath, sourceLocale);
    const targetData = normalizeData(src.data, locale, translationKey);
    const contents = serialize(targetData, src.body);
    const { changed } = await writeIfChanged(targetPath, contents);
    if (changed) {
      changes.push(
        `${CHECK_ONLY ? "would create" : "created"} ${rel(targetPath)}`
      );
    }
    if (CHECK_ONLY) {
      errors.push(`missing counterpart: ${rel(targetPath)}`);
    }
    pair[locale] = { filePath: targetPath, data: targetData, body: src.body };
  }

  if (pair.en && pair.cn) {
    for (const field of SHARED_FIELDS) {
      if (!deepEqual(pair.en.data[field], pair.cn.data[field])) {
        errors.push(
          `shared-metadata drift on "${field}" between ${rel(pair.en.filePath)} and ${rel(pair.cn.filePath)}`
        );
      }
    }
  }

  if (pair.cn) {
    const ratio = cjkRatio(pair.cn.body);
    if (ratio < CJK_MIN_RATIO) {
      errors.push(
        `CN body looks untranslated (CJK ratio ${ratio.toFixed(2)} < ${CJK_MIN_RATIO}): ${rel(pair.cn.filePath)}`
      );
    }
  }
}

if (changes.length > 0) {
  console.log(changes.join("\n"));
} else {
  console.log("Post locale pairs are already in sync.");
}

if (CHECK_ONLY && errors.length > 0) {
  console.error("\nLocale check failed:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exitCode = 1;
}
