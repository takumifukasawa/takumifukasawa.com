// Where a UV-space footprint lands in the world.
//
// This is the one file that differs between "greeble on a plane" and "greeble on a body". subdivide.ts
// returns rectangles in an abstract 2D domain; the flat sketch reads that domain as the ground, and this
// one reads it as the UV of a surface. Nothing downstream (heights, timing, hashing) changes.
//
// Swapping this for a real mesh later means implementing the same `at()` -- position, normal, tangent and
// the local scale of one UV unit. Deriving all of that from finite differences (rather than from an
// analytic derivative) is deliberate: a sampled mesh can only offer finite differences, so the frame maths
// downstream stays identical when the source changes.
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

// Never sample the exact poles: there the parameterisation collapses, every cell in the top row becomes a
// zero-width sliver and the normal is undefined.
const POLE = 0.94;
const EPS = 0.002;

const pu = new THREE.Vector3();
const pv = new THREE.Vector3();
const du = new THREE.Vector3();
const dv = new THREE.Vector3();

// A product of sinusoids in direction space instead of a noise library: smooth, cheap, seedable, and
// -- the part that matters -- a pure function of position, so it cannot drift over a long recording.
const bump = (x: number, y: number, z: number, freq: number, p1: number, p2: number) =>
  Math.sin(freq * x + p1) * Math.sin(freq * 0.8 * y - p2) * Math.sin(freq * 1.1 * z + p2) +
  0.45 * Math.sin(freq * 1.9 * x - p2) * Math.sin(freq * 2.2 * y + p1) * Math.sin(freq * 1.7 * z - p1);

// The body breathes. Integer multiples of the loop frequency only: anything else and the recording has a
// seam, which is the same rule the growth curve follows (decision 0005). The spatial term inside the sine
// makes the pulse travel across the body instead of inflating it uniformly.
const pulse = (x: number, y: number, z: number, phase: number) =>
  0.62 * Math.sin(phase + (x * 2.7 + y * 1.9 + z * 2.3)) +
  0.38 * Math.sin(2 * phase + (x * -1.3 + y * 3.1 + z * 1.1));

export const createSurface = (params: Params): Surface => {
  // Read from `params` on every sample rather than closing over the values: the pane mutates that object
  // in place, and the body knobs are live (LIVE_KEYS) so they have to take effect without a rebuild.
  const point = (u: number, v: number, time: number, out: THREE.Vector3) => {
    const seed = params['seed'] * 0.618;
    const lat = (v - 0.5) * Math.PI * POLE;
    const lon = u * Math.PI * 2;
    const cl = Math.cos(lat);
    const x = cl * Math.cos(lon);
    const y = Math.sin(lat);
    const z = cl * Math.sin(lon);
    const r =
      params['radius'] *
      (1 +
        params['lumps'] * bump(x, y, z, params['lumpScale'], seed * 7.1, seed * 3.3) +
        params['breathe'] * pulse(x, y, z, (time / params['loopPeriod']) * Math.PI * 2));
    out.set(x * r, y * r, z * r);
  };

  return {
    'at': (u, v, time, out) => {
      point(u, v, time, out['position']);
      point(u + EPS, v, time, pu);
      point(u, v + EPS, time, pv);

      du.subVectors(pu, out['position']).divideScalar(EPS);
      dv.subVectors(pv, out['position']).divideScalar(EPS);

      out['scaleU'] = du.length();
      out['scaleV'] = dv.length();
      out['tangent'].copy(du).normalize();
      // Outward because v increases toward +y and u counter-clockwise; cross(du, dv) follows that.
      out['normal'].crossVectors(du, dv).normalize();
    },
  };
};
