# lokalverket-no

Website for [lokalverket.no](https://lokalverket.no).

## Tech

- [Astro](https://astro.build) (static output, zero JS by default)
- Vanilla CSS with CSS custom properties
- Norwegian (single language)

## Development

```
npm install
npm run dev      # http://localhost:4321
npm run build    # Static output to dist/
```

### Branch previews

The hypervisor's preview server serves a branch from `/lokalverket-no/<branch>/`,
so the build has to carry that path as its base or every asset 404s while the
page still renders.

```
npm run preview:build
site-preview publish lokalverket-no dist
```

`preview:build` derives the base from the current branch the same way the
publisher names its directory, and prints the publish command. `BRANCH=`
overrides it, which the host's combined build uses (`BRANCH=all`); `publish`
itself always names the preview by the branch that is checked out. A plain
`npm run build` is the deploy build, unchanged.

## Status

Work in progress. The live site serves a holding page and is set to `noindex`.
