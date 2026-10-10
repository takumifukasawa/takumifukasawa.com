// UV sphere, built by hand instead of THREE.SphereGeometry (see lab/AGENTS.md: three.js is plumbing,
// not a source of finished parts). Provided — the interesting work in this sketch is the shader and
// the cube faces, not this.
//
// Worth noting while reading it:
// - For a unit sphere centred on the origin, the normal *is* the position. That is only true here.
// - The seam at u = 0 / u = 1 needs duplicated vertices (same position, different u), hence
//   (segmentsX + 1) columns rather than segmentsX.
// - The poles are degenerate: a whole row of vertices collapses to one point, so the triangles
//   there are slivers. Every UV sphere has this; it is why icospheres exist.

import * as THREE from 'three';

export const createSphereGeometry = (radius: number, segmentsX: number, segmentsY: number) => {
  const position: number[] = [];
  const normal: number[] = [];
  const index: number[] = [];

  for (let y = 0; y <= segmentsY; y++) {
    const v = y / segmentsY;
    const theta = v * Math.PI; // 0 at +Y pole, PI at -Y pole
    for (let x = 0; x <= segmentsX; x++) {
      const u = x / segmentsX;
      const phi = u * Math.PI * 2;
      const nx = Math.sin(theta) * Math.cos(phi);
      const ny = Math.cos(theta);
      const nz = Math.sin(theta) * Math.sin(phi);
      normal.push(nx, ny, nz);
      position.push(nx * radius, ny * radius, nz * radius);
    }
  }

  const stride = segmentsX + 1;
  for (let y = 0; y < segmentsY; y++) {
    for (let x = 0; x < segmentsX; x++) {
      const a = y * stride + x;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      // Counter-clockwise when seen from outside, so the default front-face winding keeps them.
      index.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geometry.setIndex(index);
  return geometry;
};
