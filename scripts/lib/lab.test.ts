import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SLUG_PATTERN, WORKSPACE_SLUGS } from './lab.ts';

// SLUG_PATTERN is the only guard on the slug a human types into `pnpm new` / `pnpm lab:add`, and the slug
// becomes the directory name, the content entry id, the R2 key and the URL at once (decision 0002), so a
// character that slips through here is permanent. There is no number prefix any more (decision 0007).
describe('SLUG_PATTERN', () => {
  for (const slug of ['greeble', 'curl-noise-ribbons', 'sdf2', 'a']) {
    test(`accepts ${slug}`, () => assert.equal(SLUG_PATTERN.test(slug), true));
  }

  // Uppercase and "_" would survive on Windows/macOS but break the URL or differ from a Linux checkout;
  // the rest would produce "lab//x" or a hidden directory.
  for (const slug of ['Greeble', 'has_underscore', 'has space', '-leading', 'trailing-', 'double--dash', '.hidden', 'a/b', '']) {
    test(`rejects ${JSON.stringify(slug)}`, () => assert.equal(SLUG_PATTERN.test(slug), false));
  }

  // A left-over numbered slug is still a legal name -- the number is just not meaningful any more.
  test('still accepts an old-style numbered slug', () => assert.equal(SLUG_PATTERN.test('001-greeble'), true));
});

// These are the slugs `pnpm lab:add` refuses, so that a sketch cannot be published at a URL that says
// "still being made" -- which decision 0007 makes permanent. Too loose and it blocks a real title.
describe('WORKSPACE_SLUGS', () => {
  for (const slug of ['wip', 'wip-a', 'wip-2', 'wip-body-test']) {
    test(`refuses ${slug}`, () => assert.equal(WORKSPACE_SLUGS.test(slug), true));
  }

  // Real titles that merely contain or resemble the word must still publish.
  for (const slug of ['wipe', 'wiper-blade', 'greeble', 'carapace', 'a-wip', 'swipe']) {
    test(`allows ${slug}`, () => assert.equal(WORKSPACE_SLUGS.test(slug), false));
  }
});
