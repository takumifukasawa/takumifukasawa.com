// The surface cells as boxes, one instance each. Each instance carries its cellIndex (instance attribute), so the
// material can look its cell's state up later (read in the fragment stage: in WebGPU compatibility mode a vertex
// stage may have no storage buffers. docs/plans/active/wip.md).
//
// instanceMatrix stays on the CPU and never changes once the shape is set: Raycaster hits instances by it.
import { BoxGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshLambertNodeMaterial, type Node } from 'three/webgpu';
import { attribute, wgslFn } from 'three/tsl';
import type { Cells } from './cells.ts';
import colorSource from './color.wgsl?raw';
import type { State } from './state.ts';

// Placeholder: the box size, and Lambert so the faces read. The color itself is color.wgsl (human-written).
const BOX_SIZE = 0.9;

export const createVoxels = (cells: Cells, state: State) => {
  const { n, surface } = cells;
  const material = new MeshLambertNodeMaterial();
  // Read in the fragment stage: colorNode is evaluated there, and the cell index arrives as a varying.
  // wgslFn's call is typed as a bare Node; color.wgsl returns vec3f.
  material.colorNode = wgslFn(colorSource)({ state: state.latest(attribute('cellIndex', 'uint')) }) as Node<'vec3'>;
  const mesh = new InstancedMesh(new BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE), material, surface.length);
  mesh.geometry.setAttribute('cellIndex', new InstancedBufferAttribute(surface, 1));

  const m = new Matrix4();
  const half = n / 2 - 0.5;
  for (let i = 0; i < surface.length; i++) {
    const c = surface[i]!;
    const x = c % n;
    const y = Math.floor(c / n) % n;
    const z = Math.floor(c / (n * n));
    mesh.setMatrixAt(i, m.makeTranslation(x - half, y - half, z - half));
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
};
