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
| Signature: Nord marine blue (mono) | resolved | marine #5E81AC primary, frost #81A1C1 links/small text; replaced oxblood+petrol (failed in dark mode) 2026-06-25 |
| Wordmark treatment (`lokal` light + `verket` bold) | locked | |
| Typeface: Geist (sans) + Geist Mono (precision accent) | locked (web) | confident grotesque |
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
| `--marine` | `#5e81ac` | Nord10. Primary accent - buttons, large accents |
| `--marine-hi` | `#6d90ba` | Accent hover/active |
| `--frost` | `#81a1c1` | Nord9. Links and small text - brighter for AA contrast on dark |

Semantic aliases: `--color-bg`, `--color-surface`, `--color-text`, `--color-muted`,
`--color-accent` (marine), `--color-link` (frost), `--color-precision` (frost). Style
against the semantic roles where possible.

Accent discipline: mono-blue system. Marine for buttons and larger accent moments;
frost for links, small text, and spec/mono captions (it clears AA on charcoal where
marine dips below). Warm paper neutral keeps the cool blue from feeling clinical.
The page stays mostly charcoal + paper - blue is the accent, not the field.

## Typography

- **Wordmark + headings + body:** Geist (`--font-wordmark` / `--font-heading` /
  `--font-body`), self-hosted via `@fontsource-variable/geist`.
- **Mono accent:** Geist Mono (`--font-mono`) via `@fontsource-variable/geist-mono`,
  for specs/part-numbers/captions - the precision side of the system.

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
