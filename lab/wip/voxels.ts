// The surface cells as boxes, one instance each. Each instance carries its cell's position (its center), and reads its cell's state
// through `state.shown` (an instance attribute, state.ts).
//
// instanceMatrix stays on the CPU and never changes once the shape is set: Raycaster hits instances by it, so a tap
// lands where the box sits at rest, not where offset.wgsl has moved it.
import { BoxGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshLambertNodeMaterial, type Node } from 'three/webgpu';
import { attribute, positionLocal, wgslFn } from 'three/tsl';
import type { Cells } from './cells.ts';
import colorSource from './color.wgsl?raw';
import offsetSource from './offset.wgsl?raw';
import type { Uniforms } from './params.ts';
import type { State } from './state.ts';

// Placeholder: the box size, and Lambert so the faces read. The color itself is color.wgsl (human-written).
const BOX_SIZE = 0.9;

export const createVoxels = (cells: Cells, state: State, uniforms: Uniforms) => {
  const { n, surface } = cells;
  const position = new Float32Array(surface.length * 3);
  const material = new MeshLambertNodeMaterial();
  // wgslFn's call is typed as a bare Node; color.wgsl returns vec3f, offset.wgsl vec3f.
  material.colorNode = wgslFn(colorSource)({ state: state.shown, colorRange: uniforms.colorRange, glow: uniforms.glow }) as Node<'vec3'>;
  // positionNode runs after the instance matrix (three r186 NodeMaterial.setupPosition), so positionLocal and the
  // offset are both in the shape's space: origin at the shape's center, one cell = 1.
  const offset = wgslFn(offsetSource)({
    state: state.shown,
    cellPosition: attribute('cellPosition', 'vec3'),
    offsetScale: uniforms.offsetScale,
    offsetCurve: uniforms.offsetCurve,
  }) as Node<'vec3'>;
  material.positionNode = positionLocal.add(offset);
  const mesh = new InstancedMesh(new BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE), material, surface.length);
  mesh.geometry.setAttribute('cellPosition', new InstancedBufferAttribute(position, 3));

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
  return mesh;
};
