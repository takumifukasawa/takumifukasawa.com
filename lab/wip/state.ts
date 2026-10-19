// The state of every cell, on the GPU, and the compute pass that steps it (step.wgsl, human-written).
//
// Two buffers, ping-pong: a step reads one and writes the other, so a cell never reads a neighbor that this same
// step has already overwritten. Two compute nodes, one per direction, so each step is one dispatch and no copy.
// `current` says which buffer holds the latest state.
//
// After each step a second, small pass copies the latest state of every surface cell into `shown`, one entry per
// instance, which the material reads as an instance attribute (voxels.ts). An attribute, not a storage read: in
// WebGPU compatibility mode a vertex stage may have no storage buffers (plan: decision log 2026-10-18).
//
// Layout, per cell: vec4f(u, v, paint, spare) (plan: decision log). Changing the number of buffers or the size
// of a cell's state changes this file and the signatures in step.wgsl / color.wgsl.
import type { Renderer } from 'three/webgpu';
import { Fn, instanceIndex, instancedArray, int, uint, uniform, vec4, wgslFn } from 'three/tsl';
import type { Cells } from './cells.ts';
import type { Uniforms } from './params.ts';
import stepSource from './step.wgsl?raw';

export const createState = (cells: Cells, uniforms: Uniforms) => {
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
    stepFn({
      prev,
      next,
      solid,
      n: uint(cells.n),
      tap: int(tap),
      index: instanceIndex,
      k: uniforms.k,
      damping: uniforms.damping,
      anchor: uniforms.anchor,
      knockRadius: uniforms.knockRadius,
      knockStrength: uniforms.knockStrength,
    }).compute(count);
  const aToB = pass(a, b);
  const bToA = pass(b, a);

  // shown[i] = the latest state of surface cell i, i.e. of cell surface[i].
  const surface = instancedArray(cells.surface, 'uint');
  const shown = instancedArray(cells.surface.length, 'vec4');
  const show = (from: typeof a) =>
    Fn(() => {
      shown.element(instanceIndex).assign(from.element(surface.element(instanceIndex)));
    })().compute(cells.surface.length);
  const showA = show(a);
  const showB = show(b);

  // Every cell back to rest, in both buffers, so it does not matter which one is current.
  const clear = Fn(() => {
    a.element(instanceIndex).assign(vec4(0));
    b.element(instanceIndex).assign(vec4(0));
  })().compute(count);

  return {
    // This instance's state, for the material (vertex or fragment stage).
    shown: shown.toAttribute(),
    // A knock on `cellIndex`, handed to the next step and only that one.
    knock: (cellIndex: number) => {
      tap.value = cellIndex;
    },
    step: (renderer: Renderer) => {
      renderer.compute(current.value === 0 ? aToB : bToA);
      renderer.compute(current.value === 0 ? showB : showA);
      current.value = 1 - current.value;
      tap.value = -1;
    },
    // Debug: drop every wave and knock. `shown` is cleared too, so the boxes are at rest even with 0 steps per frame.
    reset: (renderer: Renderer) => {
      renderer.compute(clear);
      renderer.compute(showA);
      tap.value = -1;
    },
  };
};

export type State = ReturnType<typeof createState>;
