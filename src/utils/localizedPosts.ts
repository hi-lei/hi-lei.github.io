import type { CollectionEntry } from "astro:content";
import { getPath } from "./getPath";
import type { Locale } from "@/i18n";
import { localizePath } from "@/i18n";

type BlogEntry = CollectionEntry<"blog">;

export function getPostTranslationKey(post: BlogEntry): string {
  return post.data.translationKey ?? post.id.replace(/\.cn$/, "");
}

function getLocaleRank(entry: BlogEntry, locale: Locale) {
  if (entry.data.locale === locale) return 2;
  if (entry.data.locale === "en") return 1;
  return 0;
}

export function getLocalizedPosts(posts: BlogEntry[], locale: Locale) {
  const postGroups = new Map<string, BlogEntry[]>();

  for (const post of posts) {
    const key = getPostTranslationKey(post);
    const current = postGroups.get(key) ?? [];
    current.push(post);
    postGroups.set(key, current);
  }

  return [...postGroups.values()]
    .map(
      group =>
        group
          .slice()
          .sort(
            (a, b) => getLocaleRank(b, locale) - getLocaleRank(a, locale)
          )[0]
    )
    .filter(Boolean);
}

export function findTranslatedPost(
  posts: BlogEntry[],
  post: BlogEntry,
  locale: Locale
) {
  const key = getPostTranslationKey(post);
  const candidates = posts.filter(
    candidate => getPostTranslationKey(candidate) === key
  );
  return (
    candidates.find(candidate => candidate.data.locale === locale) ??
    candidates.find(candidate => candidate.data.locale === "en") ??
    post
  );
}

export function getLocalizedPostPath(post: BlogEntry, locale: Locale) {
  return localizePath(getPath(post.id, post.filePath), locale);
}
