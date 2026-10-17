// The state of every cell, on the GPU, and the compute pass that steps it (step.wgsl, human-written).
//
// Two buffers, ping-pong: a step reads one and writes the other, so a cell never reads a neighbor that this same
// step has already overwritten. Two compute nodes, one per direction, so each step is one dispatch and no copy.
// `current` says which buffer holds the latest state; the material reads through it (voxels.ts).
//
// Layout, per cell: vec4f(u, v, paint, spare) (plan: decision log). Changing the number of buffers or the size
// of a cell's state changes this file and the signatures in step.wgsl / color.wgsl.
import type { Renderer } from 'three/webgpu';
import { instanceIndex, instancedArray, int, uint, uniform, wgslFn } from 'three/tsl';
import type { Cells } from './cells.ts';
import stepSource from './step.wgsl?raw';

export const createState = (cells: Cells) => {
  const count = cells.n ** 3;
  const a = instancedArray(count, 'vec4');
  const b = instancedArray(count, 'vec4');
  const solid = instancedArray(Uint32Array.from(cells.solid), 'uint');
  // 0: `a` holds the latest state, 1: `b` does.
  const current = uniform(0, 'uint');
  const tap = uniform(-1, 'int');

  // step.wgsl is plain WGSL, with no return type (WGSL has no `void`). three's wgslFn parser needs one written out,
  // `-> void`, and drops it again when it emits the function; add it here so the file stays valid for editors.
  const stepFn = wgslFn(stepSource.replace(/\)\s*\{/, ') -> void {'));
  const pass = (prev: typeof a, next: typeof a) =>
    stepFn({ prev, next, solid, n: uint(cells.n), tap: int(tap), index: instanceIndex }).compute(count);
  const aToB = pass(a, b);
  const bToA = pass(b, a);

  // The cell `cellIndex` of the latest state, for the material.
  const latest = (cellIndex: Parameters<typeof a.element>[0]) => current.equal(uint(0)).select(a.element(cellIndex), b.element(cellIndex));

  return {
    latest,
    // A knock on `cellIndex`, handed to the next step and only that one.
    knock: (cellIndex: number) => {
      tap.value = cellIndex;
    },
    step: (renderer: Renderer) => {
      renderer.compute(current.value === 0 ? aToB : bToA);
      current.value = 1 - current.value;
      tap.value = -1;
    },
  };
};

export type State = ReturnType<typeof createState>;
