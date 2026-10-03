// The naming rule nixfleet's `site-preview` uses for the directory a build
// lands in, so build-preview.mjs can bake the same path into the build as its
// base. Kept in step with the publisher's `slug` by hand, which is why
// build-preview.test.mjs pins it against what the publisher prints: a preview
// path is two levels under its root, so anything a path cannot carry becomes a
// dash.

export const SITE = 'lokalverket-no';

export const slug = (value) => value
  .replace(/[^A-Za-z0-9._-]/g, '-')
  .replace(/^-+|-+$/g, '')
  .replace(/-+/g, '-');

export const previewBase = (branch, site = SITE) => `/${slug(site)}/${slug(branch)}/`;
