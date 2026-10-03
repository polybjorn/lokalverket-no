#!/usr/bin/env node
// Pins preview-core.mjs to the publisher's naming. Expected values are what
// nixfleet's site-preview `slug` prints for the same names, so a build lands
// where its base says it will; a drift here is every asset 404ing on a preview
// whose page still renders.

import test from 'node:test';
import assert from 'node:assert/strict';
import { slug, previewBase } from './preview-core.mjs';

test('names a branch the way the publisher names its directory', () => {
  assert.equal(slug('main'), 'main');
  assert.equal(slug('herd/branch-preview'), 'herd-branch-preview');
  assert.equal(slug('feat/a b//c'), 'feat-a-b-c');
  assert.equal(slug('/herd/x/'), 'herd-x');
  assert.equal(slug('v1.2_rc'), 'v1.2_rc');
});

test('builds the base under the site directory, with a trailing slash', () => {
  assert.equal(previewBase('herd/issue-57'), '/lokalverket-no/herd-issue-57/');
});
