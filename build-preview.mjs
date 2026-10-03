#!/usr/bin/env node
// npm run preview:build
//
// Builds this site for the fleet's preview server, which serves a branch from
// a subpath: `http://hypervisor.pebblecove.net:8455/lokalverket-no/<branch>/`.
// Ported from bjorn/rovar-no (#117, #135).
//
// The base path has to be baked into the build and has to match the path the
// publisher will put it on, or the page renders with every asset missing. This
// derives it the way `site-preview` does and hands back the publish command.
// astro.config.mjs reads PREVIEW_BASE, and the one hand-written root path (the
// favicon in Layout.astro) goes through BASE_URL, so setting it is the whole job.
//
//   npm run preview:build              # base from the current branch
//   BRANCH=all npm run preview:build   # what the host's combined build runs

import { execFileSync, spawnSync } from 'node:child_process';
import { SITE, previewBase } from './preview-core.mjs';

const branch = process.env.BRANCH
  ?? execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();

if (!branch || branch === 'HEAD') {
  console.error('preview:build: cannot read a branch name; pass one as BRANCH=');
  process.exit(2);
}

const base = previewBase(branch);
console.log(`preview:build: building ${branch} for ${base}`);

const run = spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, PREVIEW_BASE: base },
});
if (run.status !== 0) process.exit(run.status ?? 1);

// site-preview names the preview by the branch dist's checkout is on, so a
// BRANCH= override is for the combined build, not for publish.
console.log(`\npreview:build: publish it with\n  site-preview publish ${SITE} dist`);
