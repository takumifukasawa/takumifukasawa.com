import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { numberOwner } from './lab.ts';

let root: string;
const sketch = (path: string) => mkdirSync(join(root, path), { recursive: true });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'lab-test-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('numberOwner', () => {
  test('is undefined when nothing has taken the number', () => {
    sketch('lab/001-a');
    assert.equal(numberOwner('002', root), undefined);
  });

  test('finds a number taken in lab/', () => {
    sketch('lab/001-a');
    assert.equal(numberOwner('001', root), 'lab/001-a');
  });

  // The point of decision 0006: archiving must not free the number.
  test('finds a number taken in lab-archives/', () => {
    sketch('lab-archives/001-mirror-sphere');
    assert.equal(numberOwner('001', root), 'lab-archives/001-mirror-sphere');
  });

  test('works when lab-archives/ does not exist', () => {
    sketch('lab/001-a');
    assert.equal(numberOwner('001', root), 'lab/001-a');
    assert.equal(numberOwner('003', root), undefined);
  });

  test('ignores directories that are not sketches', () => {
    sketch('lab/.build-meta');
    sketch('lab/core');
    assert.equal(numberOwner('001', root), undefined);
  });
});
