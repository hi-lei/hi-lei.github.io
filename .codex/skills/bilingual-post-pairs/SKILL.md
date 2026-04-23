---
name: bilingual-post-pairs
description: Use when creating, editing, or translating blog posts in this repo. Enforces that every post exists as an English + Chinese pair, with shared metadata and a real Chinese translation (never a stub).
---

# Bilingual Post Pairs

Every blog post must ship in two files:

- English: `src/data/blog/<slug>.md`
- Chinese: `src/data/blog/<slug>.cn.md`

The pair must match on:

- `translationKey`
- `pubDatetime`
- `featured`
- `draft`
- `tags`

The pair may differ on `title`, `description`, and body. The English file keeps `slug`; the Chinese file does not (the route derives from the filename and `translationKey`).

## Required workflow

1. Run `npm run posts:sync-locales`.
   - If a counterpart is missing, the script scaffolds it by copying the source body and normalizing frontmatter.
   - A scaffolded `.cn.md` still has English content — it is **not** a finished post.
2. **Translate the scaffolded side.** Replace the English body with a natural, idiomatic Chinese version. Keep code blocks, file paths, CLI commands, and proper nouns verbatim. Translate captions, prose, headings, and table copy. Do not leave English paragraphs behind.
3. When editing an existing post, update the paired file in the same commit so shared metadata and conceptual content stay aligned.
4. Run `npm run posts:check-locales` before handing work off. The check must pass.

## What the check enforces

`npm run posts:check-locales` (also wired into `npm run build`) fails on:

- Missing counterpart file (either locale).
- Drift in any shared metadata field listed above.
- Untranslated `.cn.md` body — detected by CJK-to-Latin-word ratio in prose. A `.cn.md` that is still mostly English will fail here.

## Do / Don't

- Do keep the English file as the canonical source for `slug`.
- Do translate the scaffolded body — do not ship a `.cn.md` with English prose.
- Do mirror shared metadata changes into both files.
- Don't invent a different slug for the translated version.
- Don't remove `translationKey`.
- Don't add `slug:` to `.cn.md` files.
- Don't create `.en.md` files — English is the base `.md` file.

## Commands

```bash
npm run posts:sync-locales    # scaffold missing counterparts, normalize frontmatter
npm run posts:check-locales   # strict validation (run before commit / PR)
```
