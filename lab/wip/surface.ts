// Where a UV-space footprint lands in the world.
//
// subdivide.ts returns rectangles in an abstract 2D domain; this file decides what that domain IS. A mesh
// version (a faceted hull, sampled through its UV) lives in this file's history; this one is the plane,
// because the piece is now about a flow across a floor and a floor is what a flow needs.
//
// The contract is unchanged, so plates, hashing, heights and timing do not know the difference.
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
  // False when the UV lands on nothing. A plane covers all of it, so this one never says no -- the mesh
  // version did, and callers still honour it.
  'at': (u: number, v: number, time: number, out: Frame) => boolean;
};

// The domain maps 1:1 onto the ground: u,v in [0,1] spans `size` world units centred on the origin. One
// unit of u is therefore `size` world units everywhere, which is why scaleU and scaleV are constant.
export const createPlaneSurface = (params: Params): Surface => ({
  'at': (u, v, _time, out) => {
    const size = params['size'];
    out['position'].set((u - 0.5) * size, 0, (v - 0.5) * size);
    out['normal'].set(0, 1, 0);
    out['tangent'].set(1, 0, 0);
    out['scaleU'] = size;
    out['scaleV'] = size;
    return true;
  },
});
