// The empty grid: a faint point at the corners of the cells, so the box reads as a voxel world before
// anything lights it.
//
// Only every `step`-th layer, counted from the floor. No ceiling: it sits nearer the camera than the floor, so
// on screen it is a bigger grid offset from the floor's, and it reads as the floor with the rain missing it.
// A point at every corner of every cell is 60k points that line up behind each other in depth, and from any
// angle that is a moire, not a grid.
import * as THREE from 'three';
import type { Params } from './params.ts';

export type Lattice = { object: THREE.Points; update: (params: Params) => void };

export const createLattice = (nx: number, h: number, nz: number, step: number): Lattice => {
  const positions: number[] = [];
  const halfX = nx / 2;
  const halfZ = nz / 2;
  for (let y = 0; y < h; y += Math.max(1, step)) {
    for (let z = 0; z <= nz; z++) {
      for (let x = 0; x <= nx; x++) positions.push(x - halfX, y, z - halfZ);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ sizeAttenuation: true, depthWrite: false });
  const object = new THREE.Points(geometry, material);
  object.frustumCulled = false;
  return {
    object,
    update: (params) => {
      material.color.setHex(params.latticeColor);
      material.size = params.latticeSize;
      object.visible = params.latticeSize > 0;
    },
  };
};
