# Lokalverket website (lokalverket.no)

Private repo. Norwegian-language site.

> Skeleton. Fill in purpose, audience, content, and deploy specifics once the
> Lokalverket context is settled. See `~/Vault/Obsidian/Software/Lokalverket.md`
> if/when that note exists.

## Stack

- Astro (static output, zero JS by default)
- Vanilla CSS with CSS custom properties, no frameworks
- Norwegian only (no i18n yet; add Astro i18n routing if other languages are needed)

## Structure

- `src/pages/` - one `.astro` file per route
- `src/layouts/Layout.astro` - shared HTML shell (head, main wrapper)
- `src/styles/global.css` - global styles and CSS variables
- `public/` - static assets served as-is (favicon, images)

## Development

- `npm run dev` - dev server on http://localhost:4321
- `npm run build` - static output to `dist/`

## Conventions

- 2-space indentation
- Minimal comments, only when logic isn't self-evident
- Vanilla JS/CSS, avoid frameworks

## Deploy

- TBD (polybjorn-en and rovar-no use GitHub Pages; decide host before launch)

## Status

Boilerplate only. Not yet deployed.
