import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { PageProblem } from './chrome.ts';
import { isEnvironmentProblem } from './page-problems.ts';

const log = (text: string): PageProblem => ({ kind: 'log', text });

// This classifier decides what the artifact check is allowed to ignore. Getting it wrong in the lenient
// direction turns the check into a green light over a broken build, so both directions are pinned here.
describe('isEnvironmentProblem', () => {
  for (const text of [
    'Could not create a WebGL context, VENDOR = 0xffff',
    'Automatic fallback to software WebGL has been deprecated',
    'WebGL is disabled',
  ]) {
    test(`ignores: ${text.slice(0, 40)}`, () => assert.equal(isEnvironmentProblem(log(text)), true));
  }

  // The dangerous direction: these all mention WebGL but are the sketch's own fault.
  for (const text of [
    'THREE.WebGLProgram: Shader Error 0 - VALIDATE_STATUS false',
    'THREE.WebGLProgram: gl.getProgramInfoLog() invalid shaders',
    'Failed to compile fragment shader: WebGL context lost',
    "TypeError: Cannot read properties of undefined (reading 'replace')",
    'Failed to load resource: the server responded with a status of 404 (Not Found) <http://x/lab/a/t.png>',
  ]) {
    test(`reports: ${text.slice(0, 40)}`, () => assert.equal(isEnvironmentProblem(log(text)), false));
  }
});
