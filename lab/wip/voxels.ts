// The surface cells as boxes, one instance each. Each instance carries its cell's position (its center), and reads its cell's state
// through `state.shown` (an instance attribute, state.ts).
//
// instanceMatrix stays on the CPU and never changes once the shape is set: Raycaster hits instances by it, so a tap
// lands where the box sits at rest, not where offset.wgsl has moved it.
//
// Taps hit `hit`, not `mesh`: the same instances as plain unit cubes, never drawn. The drawn boxes are smaller than
// a cell and rounded, so a ray could slip between them, cross the hollow inside and hit the far side
// (2026-10-20: 1-3 % of taps at grid 32, more with a larger bevel). Unit cubes leave no gap.
import { BoxGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardNodeMaterial, type Node } from 'three/webgpu';
import { attribute, positionLocal, wgslFn } from 'three/tsl';
// Imports BoxGeometry from 'three': the same three.core.js class as 'three/webgpu', so no second copy of three.
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Cells } from './cells.ts';
import colorSource from './color.wgsl?raw';
import offsetSource from './offset.wgsl?raw';
import type { Params, Uniforms } from './params.ts';
import type { State } from './state.ts';

// Placeholder: the box size, and Standard so the rounded edges catch a highlight (roughness / metalness knobs). The color itself is color.wgsl (human-written).
// The edges are rounded (bevelRadius / bevelSegments) so the light catches them.
const BOX_SIZE = 0.9;

const createBox = (radius: number, segments: number) => new RoundedBoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE, segments, radius);

export const createVoxels = (cells: Cells, state: State, uniforms: Uniforms, params: Params) => {
  const { n, surface } = cells;
  const position = new Float32Array(surface.length * 3);
  const material = new MeshStandardNodeMaterial();
  // wgslFn's call is typed as a bare Node; color.wgsl returns vec3f, offset.wgsl vec3f.
  material.colorNode = wgslFn(colorSource)({
    state: state.shown,
    colorRange: uniforms.colorRange,
    glow: uniforms.glow,
    restColor: uniforms.restColor,
    sinkColor: uniforms.sinkColor,
    riseColor: uniforms.riseColor,
    sinkIntensity: uniforms.sinkIntensity,
    riseIntensity: uniforms.riseIntensity,
  }) as Node<'vec3'>;
  // positionNode runs after the instance matrix (three r186 NodeMaterial.setupPosition), so positionLocal and the
  // offset are both in the shape's space: origin at the shape's center, one cell = 1.
  const offset = wgslFn(offsetSource)({
    state: state.shown,
    cellPosition: attribute('cellPosition', 'vec3'),
    offsetScale: uniforms.offsetScale,
    offsetCurve: uniforms.offsetCurve,
  }) as Node<'vec3'>;
  material.positionNode = positionLocal.add(offset);
  const cellPosition = new InstancedBufferAttribute(position, 3);
  let bevel = { radius: params.bevelRadius, segments: params.bevelSegments };
  const mesh = new InstancedMesh(createBox(bevel.radius, bevel.segments), material, surface.length);
  mesh.geometry.setAttribute('cellPosition', cellPosition);

  const m = new Matrix4();
  const half = n / 2 - 0.5;
  for (let i = 0; i < surface.length; i++) {
    const c = surface[i]!;
    const x = c % n;
    const y = Math.floor(c / n) % n;
    const z = Math.floor(c / (n * n));
    position.set([x - half, y - half, z - half], i * 3);
    mesh.setMatrixAt(i, m.makeTranslation(x - half, y - half, z - half));
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();

  // Every frame: the material's knobs, and the bevel's, which change the geometry (rebuilt only when they move).
  const update = () => {
    material.roughness = params.roughness;
    material.metalness = params.metalness;
    if (params.bevelRadius === bevel.radius && params.bevelSegments === bevel.segments) return;
    bevel = { radius: params.bevelRadius, segments: params.bevelSegments };
    const old = mesh.geometry;
    mesh.geometry = createBox(bevel.radius, bevel.segments);
    mesh.geometry.setAttribute('cellPosition', cellPosition);
    old.dispose();
  };

  // Shares mesh's instanceMatrix. Added under mesh so it turns with the shape; invisible, so it is never drawn,
  // but Raycaster still tests it (it does not check `visible`).
  const hit = new InstancedMesh(new BoxGeometry(1, 1, 1), material, surface.length);
  hit.instanceMatrix = mesh.instanceMatrix;
  hit.visible = false;
  hit.computeBoundingSphere();
  mesh.add(hit);

  return { mesh, hit, update };
};
