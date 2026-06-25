# Lokalverket website design guide

Implementation guide for the website. The authoritative brand source is
`~/Vault/Lokalverket/Brand/Brand guide/design-brief.md`; this file derives from it
and records how the site applies it. When they disagree, the brief wins.

Tokens live in [`src/styles/global.css`](src/styles/global.css). Use the CSS
variables, never hard-coded values.

## Positioning

Commercial precision production house (design + make). Premium, engineered,
material-neutral. Deliberately *not* the warm community maker-fair look. This
steers everything below: dark base, restrained accent, confident grotesque type.

## Status of decisions

| Decision | State | Note |
|----------|-------|------|
| Strategy: clean break from polybjorn | locked | no amber reuse |
| Base neutrals (ink/paper/grey ramp) | locked | |
| Signature: oxblood + petrol accent | resolved | final hue is an Affinity eye decision; hexes here are provisional |
| Wordmark treatment (`lokal` light + `verket` bold) | locked | |
| Typeface: confident grotesque (Space Grotesk) | locked (web) | |
| Wordmark case: lowercase | locked | |
| Symbol / logo mark (C/E/D) | open | Affinity work; favicon is a placeholder until then |

## Colour

| Token | Hex | Role |
|-------|-----|------|
| `--ink` | `#1e2228` | Base background, theme-color |
| `--ink-soft` | `#2a2e35` | Cards, sections, raised surfaces |
| `--line` | `#3a3e45` | Borders, dividers |
| `--paper` | `#f4f1ec` | Primary text on dark |
| `--grey-100/300/500/700` | ramp | Body/UI greys on dark |
| `--oxblood` | `#7a2e2a` | Primary accent - material/craft side |
| `--petrol` | `#1f5a66` | Secondary accent - digital/precision side, used sparingly |

Semantic aliases: `--color-bg`, `--color-surface`, `--color-text`, `--color-muted`,
`--color-accent` (oxblood), `--color-precision` (petrol). Style against the semantic
roles where possible.

Accent discipline: oxblood for brand/craft moments, petrol reserved for
precision/technical UI (specs, part numbers, captions). Don't let either dominate -
the page is mostly charcoal + paper.

## Typography

- **Wordmark + headings:** Space Grotesk (`--font-wordmark` / `--font-heading`),
  self-hosted via `@fontsource-variable/space-grotesk` (weights 300-700).
- **Body:** system sans (`--font-body`). Can move to a matched grotesque later.
- **Mono accent:** system mono (`--font-mono`) for specs/part-numbers/captions -
  reinforces the precision side without a font download.

Wordmark: lowercase, `lokal` weight 300 / muted grey, `verket` weight 700 / paper.

Scale (1.25 minor third): `--text-xs` -> `--text-4xl`. Headings use
`--font-heading`, tight tracking (`-0.02em`).

## Spacing & layout

- Spacing scale: `--space-1` (0.25rem) -> `--space-24` (6rem).
- `--content-width` 64rem for page width, `--measure` 38rem for readable text.
- `--radius` 4px (kept tight - engineered, not soft).

## Open / next

- Lock the logo mark in Affinity, then replace `public/favicon.svg` and add the
  real favicon set.
- Finalise oxblood/petrol hues on screen; update tokens here.
- Decide whether body moves to a self-hosted grotesque.
- Build out homepage sections (hero / services / about / contact) on `design`.
