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
- `.forgejo/workflows/` - the gate on the self-hosted runner. Not the deploy;
  see below. `ci.yml` builds and lints, `delete-merged-branch.yml` sweeps merged
  `herd/` branches on merge and daily, `deps-update.yml` opens the monthly
  dependency PR, `merge-audit.yml` checks merges actually landed
- `.nvmrc` - the node version, in one place. Both the gate and the Pages deploy
  read it; `ci.yml` fails if the runner disagrees with it
- `check-attribution.sh`, `check-workflow-inputs.sh`, `check-merged-prs.mjs` -
  the checks the gate runs. Each is runnable by hand, which is the point
- `check-merged-prs.test.mjs` - pins the behaviour of the check above, which has
  two paths that fail open, so a broken watchdog would read as a healthy one.
  Offline: git fixtures in a temp dir and a stub API. Run it after any edit to
  the check, and break a guard once to confirm the test still catches it
- `sweep-merged-branches.mjs` + its `.test.mjs` and `sweep-preserved-branches.txt`
  - the only thing here that deletes a branch. Everything that decides anything
  goes through git; the forge API is not consulted, because it has answered both
  the delete and the verification with success over a ref that was still there
  (nixfleet #172, #194). It retries within a run rather than reporting on the
  first failure, since the forge restores the ref within about two seconds of a
  successful delete. The preserved file is data, not code, so taking a branch off
  the list does not need a code review
- `merge-audit-acknowledged.json` - orphaned merges already re-landed, so the
  daily audit does not fail on them for a week. A record of what happened, not
  a change of behaviour, which is why it is data rather than code
- [`DESIGN.md`](DESIGN.md) - how the site applies the brand (tokens, type,
  colour, decision status). The authoritative source is
  `~/Vault/Lokalverket/Brand/Brand guide/design-brief.md`; when they disagree,
  the brief wins. **Read DESIGN.md before any visual change.**

## Development

- `npm run dev` - dev server on http://localhost:4321
- `npm run build` - static output to `dist/`

## Branches

**`main` is where the site lives.** Every push to it deploys to GitHub Pages.
Preview locally with `npm run dev` rather than pushing WIP; if a change ever
needs to live off-machine before it's ready, cut a short-lived branch and delete
it on merge - `delete-merged-branch.yml` does that automatically for `herd/*`,
on the merge and again every morning until the ref actually stays gone.

Two kinds of branch are expected to exist and are not WIP:

- `herd/<topic>` - agent work, deleted on merge
- `deps-update` - the rolling branch `deps-update.yml` force-pushes each month.
  It is deliberately outside the `herd/` prefix so the cleanup job leaves it
  alone; it is meant to persist and be reused, not deleted

This said "single branch: `main`" until 2026-09-14, and stopped being true when
the scheduled dependency job landed. Before that, a standing `design` branch
existed until 2026-07-31 and was dropped - it made the merge, not the code, the
risky step, and it never actually kept anything private: the repo is public, so
a file on any pushed branch is readable.

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
- **The forge gate and the deploy are different builds on different runners**,
  and only the deploy publishes. `withastro/action` takes a `node-version` and
  has no `node-version-file`, so `deploy.yml` reads `.nvmrc` into a step output
  and passes that - an unknown input there is ignored silently rather than
  rejected, which once dropped the pin and broke a deploy with the gate green.
- Custom domain `lokalverket.no` (`public/CNAME`), **already live**: DNS is at
  Domeneshop (hyp.net) with the four GitHub Pages A records (185.199.108-111.153)
  and `www` CNAMEd to `polybjorn.github.io`. HTTPS enforced, cert issued for both
  apex and `www`.
- Moving the zone to Cloudflare and proxying it (the polybjorn.com/.no pattern)
  stays an option for CDN/analytics, but nothing is waiting on it.

## Status

Live at `https://lokalverket.no`, serving a work-in-progress holding page and
carrying a site-wide `noindex`. The full homepage (hero / tjenester / om /
kontakt) was pulled back on 2026-07-31: it made firm claims (named services, a
±0.1 mm tolerance, an offer CTA) on placeholder copy, while the logo mark is
unresolved and the AS is not registered. It is parked in git history at
`a1b31c9` - `git show a1b31c9:src/pages/index.astro` restores it.

Before it goes back up: settle the copy, land the real brand mark (DESIGN.md),
have an org.nr. Then drop the `noindex` in `src/layouts/Layout.astro` and the
explanatory note in `public/robots.txt`.
