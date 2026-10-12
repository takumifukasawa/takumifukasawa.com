// Cell[] -> one InstancedMesh, and the per-frame matrix update. Plumbing, not the subject: this file only
// moves numbers that subdivide / height / growth decided.
import * as THREE from 'three';
import { cellDelay, growth } from './growth.ts';
import { cellHeight } from './height.ts';
import type { Params } from './params.ts';
import type { Cell } from './subdivide.ts';

export type Blocks = {
  'mesh': THREE.InstancedMesh;
  'cells': Cell[];
  'heights': number[];
  'delays': number[];
};

export const createBlocks = (cells: Cell[], params: Params): Blocks => {
  // Pivot at the bottom face, so scaling y grows the box upward instead of from its centre. Doing it in the
  // geometry keeps the per-instance matrix a plain compose() with no corrective offset.
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  geometry.translate(0, 0.5, 0);

  // Dark brushed metal. Light enough that the subdivision is readable while it is being written -- taking it
  // back down toward black is a look decision, not a plumbing one.
  const material = new THREE.MeshStandardMaterial({ color: 0x59636b, roughness: 0.4, metalness: 0.8 });

  const mesh = new THREE.InstancedMesh(geometry, material, cells.length);
  mesh.frustumCulled = false; // one draw call covering the whole field; the bounding sphere is meaningless
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return {
    'mesh': mesh,
    'cells': cells,
    // Static per-instance data, computed once. Only the growth factor changes per frame.
    'heights': cells.map((cell) => cellHeight(cell, params)),
    'delays': cells.map((cell) => cellDelay(cell, params)),
  };
};

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();

export const updateBlocks = (blocks: Blocks, time: number, params: Params) => {
  const cells = blocks['cells'];
  const gap = params['gap'];

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    const g = growth(time, blocks['delays'][i]!, params);

    position.set(cell.x + cell.w / 2, 0, cell.z + cell.d / 2);
    // A floor on y: a zero scale collapses the matrix and the normals go undefined (black flicker).
    scale.set(Math.max(cell.w - gap, 0.001), Math.max(blocks['heights'][i]! * g, 0.001), Math.max(cell.d - gap, 0.001));
    matrix.compose(position, quaternion, scale);
    blocks['mesh'].setMatrixAt(i, matrix);
  }

  blocks['mesh'].instanceMatrix.needsUpdate = true;
};
