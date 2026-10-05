# Lokalverket

Website for [lokalverket.no](https://lokalverket.no), a static Norwegian-language Astro site. It is a work in progress: the live site serves a holding page and is set to `noindex`.

## Quick start

```
npm install
npm run dev      # http://localhost:4321
npm run build    # Static output to dist/
npm run preview  # Serve the built output
```

## Requirements

Node >= 22.12 (`engines` in `package.json`; `.nvmrc` pins 24 for CI and the deploy). The site is [Astro](https://astro.build) with static output, zero JS by default, and vanilla CSS with custom properties. Norwegian only.

## License

MIT, see [LICENSE](LICENSE).
