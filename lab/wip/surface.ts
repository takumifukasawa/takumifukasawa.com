// Where a UV-space footprint lands in the world.
//
// This is the one file that differs between "greeble on a plane" and "greeble on a body". subdivide.ts
// returns rectangles in an abstract 2D domain; the flat sketch (lab/greeble/) reads that domain as the
// ground, and this one reads it as the UV of a mesh. Nothing downstream -- heights, timing, hashing, the
// emissive bars -- knows the difference.
//
// The mesh is pod.glb, built by pod.blender.py as a parametric grid so that u runs around the body and v
// along it, with a single seam where u wraps. That matters more than the shape does: an unwrapped mesh
// would scatter the panels across UV islands and tear them at every island edge.
import * as THREE from 'three';
import type { Params } from './params.ts';

export type Frame = {
  'position': THREE.Vector3;
  'normal': THREE.Vector3;
  'tangent': THREE.Vector3; // along +u
  'scaleU': number; // world length of one unit of u at this point
  'scaleV': number;
};

export const createFrame = (): Frame => ({
  'position': new THREE.Vector3(),
  'normal': new THREE.Vector3(),
  'tangent': new THREE.Vector3(),
  'scaleU': 1,
  'scaleV': 1,
});

export type Surface = {
  'at': (u: number, v: number, time: number, out: Frame) => void;
};

// The body breathes. Integer multiples of the loop frequency only: anything else and the recording has a
// seam, which is the same rule the growth curve follows (decision 0005). The spatial term inside the sine
// makes the pulse travel across the body instead of inflating it uniformly.
const pulse = (x: number, y: number, z: number, phase: number) =>
  0.62 * Math.sin(phase + (x * 2.7 + y * 1.9 + z * 2.3)) +
  0.38 * Math.sin(2 * phase + (x * -1.3 + y * 3.1 + z * 1.1));

// UV-space bins, so a lookup tests a handful of triangles instead of all of them. 64 x 64 over ~16k
// triangles is about four per bin.
const BINS = 64;

export const createMeshSurface = (geometry: THREE.BufferGeometry, params: Params): Surface => {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const normal = geometry.getAttribute('normal') as THREE.BufferAttribute;
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  const indexAttr = geometry.getIndex();
  if (!normal || !uv) throw new Error('pod.glb must carry normals and UVs');

  // Scale the body to params['radius'] once, here. Everything else in the sketch (camera distance, fog,
  // depth of field, the height of the greeble) is expressed in multiples of radius, so the mesh has to
  // join that scale rather than impose its own.
  geometry.computeBoundingSphere();
  const scale = params['radius'] / (geometry.boundingSphere?.radius ?? 1);
  const px = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    px[i * 3] = position.getX(i) * scale;
    px[i * 3 + 1] = position.getY(i) * scale;
    px[i * 3 + 2] = position.getZ(i) * scale;
  }

  const triCount = indexAttr ? indexAttr.count / 3 : position.count / 3;
  const corner = (t: number, k: number) => (indexAttr ? indexAttr.getX(t * 3 + k) : t * 3 + k);

  // Per triangle, precomputed once: the UV origin and edges, and the exact dP/du and dP/dv.
  //
  // A mesh gives these in closed form -- solve the 2x2 system relating the triangle's UV edges to its
  // position edges -- so unlike the analytic version there is no finite difference and no epsilon to pick.
  const tri = {
    u0: new Float32Array(triCount), v0: new Float32Array(triCount),
    d1u: new Float32Array(triCount), d1v: new Float32Array(triCount),
    d2u: new Float32Array(triCount), d2v: new Float32Array(triCount),
    invDet: new Float32Array(triCount),
    dPdu: new Float32Array(triCount * 3), dPdv: new Float32Array(triCount * 3),
  };
  const bins: number[][] = Array.from({ length: BINS * BINS }, () => []);

  for (let t = 0; t < triCount; t++) {
    const a = corner(t, 0);
    const b = corner(t, 1);
    const c = corner(t, 2);

    const au = uv.getX(a);
    const av = uv.getY(a);
    const d1u = uv.getX(b) - au;
    const d1v = uv.getY(b) - av;
    const d2u = uv.getX(c) - au;
    const d2v = uv.getY(c) - av;
    const det = d1u * d2v - d2u * d1v;
    // A triangle with zero UV area (a collapsed pole ring) can never be hit, so leave it out of the bins.
    if (det === 0) continue;
    const invDet = 1 / det;

    tri.u0[t] = au; tri.v0[t] = av;
    tri.d1u[t] = d1u; tri.d1v[t] = d1v;
    tri.d2u[t] = d2u; tri.d2v[t] = d2v;
    tri.invDet[t] = invDet;

    for (let k = 0; k < 3; k++) {
      const e1 = px[b * 3 + k]! - px[a * 3 + k]!;
      const e2 = px[c * 3 + k]! - px[a * 3 + k]!;
      tri.dPdu[t * 3 + k] = (e1 * d2v - e2 * d1v) * invDet;
      tri.dPdv[t * 3 + k] = (e2 * d1u - e1 * d2u) * invDet;
    }

    const lo = (x: number) => Math.max(0, Math.min(BINS - 1, Math.floor(x * BINS)));
    const uMin = lo(Math.min(au, uv.getX(b), uv.getX(c)));
    const uMax = lo(Math.max(au, uv.getX(b), uv.getX(c)));
    const vMin = lo(Math.min(av, uv.getY(b), uv.getY(c)));
    const vMax = lo(Math.max(av, uv.getY(b), uv.getY(c)));
    for (let bu = uMin; bu <= uMax; bu++) {
      for (let bv = vMin; bv <= vMax; bv++) bins[bv * BINS + bu]!.push(t);
    }
  }

  // Reused across the whole frame; this runs once per instance per frame.
  const hit = { t: -1, b0: 0, b1: 0, b2: 0 };

  const test = (list: number[], u: number, v: number): boolean => {
    for (const t of list) {
      const pu = u - tri.u0[t]!;
      const pv = v - tri.v0[t]!;
      const b1 = (pu * tri.d2v[t]! - pv * tri.d2u[t]!) * tri.invDet[t]!;
      const b2 = (pv * tri.d1u[t]! - pu * tri.d1v[t]!) * tri.invDet[t]!;
      const b0 = 1 - b1 - b2;
      if (b0 >= -1e-6 && b1 >= -1e-6 && b2 >= -1e-6) {
        hit.t = t; hit.b0 = b0; hit.b1 = b1; hit.b2 = b2;
        return true;
      }
    }
    return false;
  };

  return {
    'at': (u, v, time, out) => {
      // Clamp rather than wrap: v has no wrap at all, and at exactly u = 1 the seam column is the right
      // answer. Wrapping would jump to the far side of the body.
      const cu = Math.min(Math.max(u, 0), 0.999999);
      const cv = Math.min(Math.max(v, 0), 0.999999);
      const bu = Math.floor(cu * BINS);
      const bv = Math.floor(cv * BINS);

      let found = test(bins[bv * BINS + bu]!, cu, cv);
      // The ring of neighbouring bins covers the float-edge cases at bin borders. If even that misses,
      // keep the previous frame -- a stale panel is invisible; a NaN one takes the whole mesh with it.
      if (!found) {
        for (let du = -1; du <= 1 && !found; du++) {
          for (let dv = -1; dv <= 1 && !found; dv++) {
            const nu = bu + du;
            const nv = bv + dv;
            if (nu < 0 || nv < 0 || nu >= BINS || nv >= BINS) continue;
            found = test(bins[nv * BINS + nu]!, cu, cv);
          }
        }
      }
      if (!found && hit.t < 0) return;

      const t = hit.t;
      const a = corner(t, 0);
      const b = corner(t, 1);
      const c = corner(t, 2);
      const { b0, b1, b2 } = hit;

      out['position'].set(
        b0 * px[a * 3]! + b1 * px[b * 3]! + b2 * px[c * 3]!,
        b0 * px[a * 3 + 1]! + b1 * px[b * 3 + 1]! + b2 * px[c * 3 + 1]!,
        b0 * px[a * 3 + 2]! + b1 * px[b * 3 + 2]! + b2 * px[c * 3 + 2]!,
      );
      // Interpolated vertex normals, not the face normal: the face normal would make every panel on a
      // smooth body sit at a visibly different angle from its neighbour.
      out['normal']
        .set(
          b0 * normal.getX(a) + b1 * normal.getX(b) + b2 * normal.getX(c),
          b0 * normal.getY(a) + b1 * normal.getY(b) + b2 * normal.getY(c),
          b0 * normal.getZ(a) + b1 * normal.getZ(b) + b2 * normal.getZ(c),
        )
        .normalize();

      out['tangent'].set(tri.dPdu[t * 3]!, tri.dPdu[t * 3 + 1]!, tri.dPdu[t * 3 + 2]!);
      // The length is the world scale of one u unit, so take it before touching the direction.
      out['scaleU'] = out['tangent'].length();
      out['scaleV'] = Math.hypot(tri.dPdv[t * 3]!, tri.dPdv[t * 3 + 1]!, tri.dPdv[t * 3 + 2]!);
      // Gram-Schmidt against the normal. dP/du lies in the *triangle's* plane while the normal is the
      // interpolated vertex normal, so on a curved body the two are a couple of degrees from perpendicular
      // (measured: 0.047). blocks.ts builds its basis from both, so without this every box is slightly
      // sheared -- invisible, but wrong, and it would get worse on a coarser mesh.
      out['tangent']
        .addScaledVector(out['normal'], -out['tangent'].dot(out['normal']))
        .normalize();

      // The mesh is static, so the life comes from here: push along the normal by a phase function of the
      // position. The frame is left as the mesh's own -- at these amplitudes re-deriving it would move the
      // panels by less than their own thickness.
      const breathe = params['breathe'];
      if (breathe !== 0) {
        const p = out['position'];
        const inv = 1 / (params['radius'] || 1);
        const offset =
          params['radius'] * breathe * pulse(p.x * inv, p.y * inv, p.z * inv, (time / params['loopPeriod']) * Math.PI * 2);
        p.addScaledVector(out['normal'], offset);
      }
    },
  };
};
