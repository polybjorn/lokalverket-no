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

**Single branch: `main`.** Every push deploys to GitHub Pages. Preview locally
with `npm run dev` rather than pushing WIP; if a change ever needs to live
off-machine before it's ready, cut a short-lived branch and delete it on merge.
(A standing `design` branch existed until 2026-07-31 and was dropped - it made
the merge, not the code, the risky step, and it never actually kept anything
private: the repo is public, so a file on any pushed branch is readable.)

**The repo is public and the domain is live**, so treat both as published:

- Anything under `src/pages/` on `main` is **served** at lokalverket.no.
- Anything committed at all is **readable on GitHub**, on any branch.

Internal design material must therefore stay out of the repo entirely, not just
out of `src/pages/`. `src/pages/styleguide.astro` is the worked example: a
gitignored symlink to `~/Vault/Lokalverket/Brand/Brand guide/styleguide.astro`,
so it renders at `localhost:4321/styleguide` off the live `global.css` (no
drifting copy) while never reaching a CI checkout. Its import is root-relative
(`/src/layouts/Layout.astro`) because Vite resolves through the symlink to the
Vault path, where `../layouts` doesn't exist.

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
