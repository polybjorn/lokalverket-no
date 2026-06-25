# Lokalverket website (lokalverket.no)

Private repo. Norwegian-language site.

> Skeleton. Fill in purpose, audience, content, and deploy specifics once the
> site direction is settled. Business context note: `~/Vault/Lokalverket/CLAUDE.md`.

## Stack

- Astro (static output, zero JS by default)
- Vanilla CSS with CSS custom properties, no frameworks
- Norwegian only (no i18n yet; add Astro i18n routing if other languages are needed)

## Structure

- `src/pages/` - one `.astro` file per route
- `src/layouts/Layout.astro` - shared HTML shell (head, main wrapper)
- `src/styles/global.css` - global styles and CSS variables
- `public/` - static assets served as-is (favicon, images)
- `assets/` - symlink to `~/Vault/Lokalverket/Brand` (gitignored). Source logos,
  favicons, brand guide, colors. Copy what the site needs into `public/`;
  don't reference the symlink from build output. Real favicons already exist at
  `assets/Favicon/`

## Development

- `npm run dev` - dev server on http://localhost:4321
- `npm run build` - static output to `dist/`

## Conventions

- 2-space indentation
- Minimal comments, only when logic isn't self-evident
- Vanilla JS/CSS, avoid frameworks

## Deploy

- Public repo, GitHub Pages via `.github/workflows/deploy.yml` (withastro/action ->
  actions/deploy-pages). Push to `main` builds and deploys.
- Custom domain: `public/CNAME` -> `lokalverket.no`. Pages source = GitHub Actions.
- DNS for lokalverket.no is at Domeneshop (hyp.net), currently parked. To go live,
  point it at GitHub Pages (A records 185.199.108-111.153 + CNAME for www), or move
  the zone to Cloudflare and proxy it (the polybjorn.com/.no pattern) for CDN/SSL/analytics.

## Status

Boilerplate only. DNS not yet pointed; not yet live.
