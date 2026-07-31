# Lokalverket website (lokalverket.no)

Public repo, Norwegian-language site. Business context note:
`~/Vault/Lokalverket/CLAUDE.md`.

## Stack

- Astro (static output, zero JS by default)
- Vanilla CSS with CSS custom properties, no frameworks
- Norwegian only (no i18n yet; add Astro i18n routing if other languages are needed)

## Structure

- `src/pages/` - one `.astro` file per route
- `src/layouts/Layout.astro` - shared HTML shell (head, main wrapper)
- `src/styles/global.css` - global styles and CSS variables (design tokens live here)
- `public/` - static assets served as-is (favicon, `CNAME`)
- `assets/` - symlink to `~/Vault/Lokalverket/Brand` (gitignored). Source logos,
  brand guide, colors. Copy what the site needs into `public/`; don't reference
  the symlink from build output. There is **no real favicon set yet** - the mark
  is unresolved (candidates in `assets/Logos/Candidates/`, itself flagged interim)
  and `public/favicon.svg` is a placeholder "L" tile. DESIGN.md tracks it; the
  mark gets drawn in Affinity, not hand-edited here
- [`DESIGN.md`](DESIGN.md) - how the site applies the brand (tokens, type,
  colour, decision status). The authoritative source is
  `~/Vault/Lokalverket/Brand/Brand guide/design-brief.md`; when they disagree,
  the brief wins. **Read DESIGN.md before any visual change.**

## Development

- `npm run dev` - dev server on http://localhost:4321
- `npm run build` - static output to `dist/`

## Branches

- `main` = live site. Every push to `main` deploys to GitHub Pages.
- `design` = work in progress. Does NOT deploy. Push WIP freely here, then merge
  `design` -> `main` when a change is ready to be public.
- **`main` serves the homepage and nothing else.** The repo is public and the
  domain is live, so anything that lands in `src/pages/` on `main` is published.
  Keep internal design material (swatch/token reference pages) off this branch -
  `styleguide.astro` was deliberately left out of the 2026-07-31 merge.

## Deploy

- GitHub Pages via `.github/workflows/deploy.yml` (withastro/action ->
  actions/deploy-pages). Push to `main` builds and deploys. Pages source = GitHub Actions.
- Custom domain `lokalverket.no` (`public/CNAME`), **already live**: DNS is at
  Domeneshop (hyp.net) with the four GitHub Pages A records (185.199.108-111.153)
  and `www` CNAMEd to `polybjorn.github.io`. HTTPS enforced, cert issued for both
  apex and `www`.
- Moving the zone to Cloudflare and proxying it (the polybjorn.com/.no pattern)
  stays an option for CDN/analytics, but nothing is waiting on it.

## Status

Live at `https://lokalverket.no` serving the homepage (hero / tjenester / om /
kontakt) from `main`. Still pre-launch in the sense that the logo mark is
unresolved and the favicon is a placeholder - see DESIGN.md.
