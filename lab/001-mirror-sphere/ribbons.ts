// Builds one BufferGeometry holding every ribbon. All of the shape lives in ribbon.vert.glsl;
// this only lays out the attributes and bakes the per-ribbon constants into them.
//
// Per-ribbon constants go in per-vertex attributes rather than uniform arrays: it wastes a few
// kilobytes and removes an entire class of indexing bugs.
//
// Anything here changes the vertex data, so the debug panel has to rebuild the geometry when it is
// touched — unlike the uniforms, which are live.

import * as THREE from 'three';

const SEGMENTS = 180;

export type RibbonOptions = {
  count: number;
  radiusMin: number;
  radiusMax: number;
  tailMin: number;
  tailMax: number;
};

export const defaultRibbonOptions: RibbonOptions = {
  count: 7,
  radiusMin: 1.35,
  radiusMax: 2.05,
  tailMin: 0.18,
  tailMax: 0.44,
};

// Deterministic: the same ribbons on every run and every machine, so the recording is reproducible.
const rand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const createRibbonGeometry = (options: RibbonOptions) => {
  const aS: number[] = [];
  const aSide: number[] = [];
  const aU: number[] = [];
  const aV: number[] = [];
  const aParams: number[] = [];
  const index: number[] = [];

  const up = new THREE.Vector3(0, 1, 0);
  const alt = new THREE.Vector3(1, 0, 0);

  for (let r = 0; r < options.count; r++) {
    // A tilted orbit plane, described by two orthonormal vectors lying in it.
    // acos(1 - 2t) rather than t * PI: that is what spreads the tilts evenly over the sphere
    // instead of bunching them at the poles.
    const theta = Math.acos(1 - 2 * rand(r + 1));
    const phi = rand(r + 41) * Math.PI * 2;
    const normal = new THREE.Vector3(
      Math.sin(theta) * Math.cos(phi),
      Math.cos(theta),
      Math.sin(theta) * Math.sin(phi),
    ).normalize();
    const u = new THREE.Vector3()
      .crossVectors(normal, Math.abs(normal.dot(up)) > 0.9 ? alt : up)
      .normalize();
    const v = new THREE.Vector3().crossVectors(normal, u).normalize();

    const radius = options.radiusMin + rand(r + 83) * (options.radiusMax - options.radiusMin);
    const offset = rand(r + 127); // where this ribbon sits in the loop
    const tail = options.tailMin + rand(r + 211) * (options.tailMax - options.tailMin);
    const pullScale = 0.65 + rand(r + 307) * 0.35; // so they do not all react identically

    const base = aS.length;
    for (let i = 0; i <= SEGMENTS; i++) {
      const s = i / SEGMENTS;
      for (const sideSign of [-1, 1]) {
        aS.push(s);
        aSide.push(sideSign);
        aU.push(u.x, u.y, u.z);
        aV.push(v.x, v.y, v.z);
        aParams.push(radius, offset, tail, pullScale);
      }
    }
    for (let i = 0; i < SEGMENTS; i++) {
      const a = base + i * 2;
      index.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
  geometry.setAttribute('aSide', new THREE.Float32BufferAttribute(aSide, 1));
  geometry.setAttribute('aU', new THREE.Float32BufferAttribute(aU, 3));
  geometry.setAttribute('aV', new THREE.Float32BufferAttribute(aV, 3));
  geometry.setAttribute('aParams', new THREE.Float32BufferAttribute(aParams, 4));
  geometry.setIndex(index);
  // The vertex shader moves vertices far from wherever three would infer bounds from, so the
  // bounding sphere has to be stated. Without it the ribbons get frustum-culled at random angles.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), options.radiusMax + 2);
  return geometry;
};
