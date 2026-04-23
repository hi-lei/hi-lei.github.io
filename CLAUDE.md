# nusmql.github.io — Claude Code guide

Personal blog and CV site built on AstroPaper, deployed to GitHub Pages. Bilingual: English under `/` and Chinese under `/cn/`.

## Blog posts are bilingual pairs

Every post must exist in both locales:

- English (canonical): `src/data/blog/<slug>.md`
- Chinese: `src/data/blog/<slug>.cn.md`

**When creating, editing, or translating a post, follow `.codex/skills/bilingual-post-pairs/SKILL.md`.** The short version:

1. `npm run posts:sync-locales` scaffolds any missing counterpart and normalizes frontmatter (`locale`, `translationKey`, strips `slug` from `.cn.md`).
2. A scaffolded `.cn.md` is English content until you translate it — translate the body into natural, technical Chinese before committing. Keep code blocks, file paths, and CLI commands verbatim.
3. `npm run posts:check-locales` is the strict gate and is also wired into `npm run build`. It fails on missing counterparts, drift in shared metadata (`translationKey`, `pubDatetime`, `featured`, `draft`, `tags`), or a `.cn.md` body that is still mostly English.

## Scripts

- `npm run dev` — sync locales, then start Astro dev server.
- `npm run build` — strict check, then Astro check + build + pagefind index.
- `npm run posts:sync-locales` — scaffold missing counterparts, normalize frontmatter.
- `npm run posts:check-locales` — strict validation (no writes).

## i18n wiring

- `src/i18n.ts` holds the UI dictionary and path helpers (`localizePath`, `stripLocaleFromPath`, `getLocaleFromPath`).
- `src/utils/localizedPosts.ts` groups posts by `translationKey` and resolves the right locale.
- `src/components/LanguageSwitcher.astro` handles the EN/CN toggle in the sidebar.
