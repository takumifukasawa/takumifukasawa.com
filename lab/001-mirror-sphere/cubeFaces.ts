// The 6 camera orientations for rendering into a cube map.
//
// A cube map is 6 square images, each the view from one point looking down one axis with a 90-degree
// field of view. To fill it, you render the scene 6 times, moving only the camera's orientation.
//
// Face order is fixed by WebGL / three.js:
//   0: +X   1: -X   2: +Y   3: -Y   4: +Z   5: -Z
//
// What this must return: the camera's *world* transform for that face — a matrix whose
// translation is `center` and whose rotation points the camera down the face's axis.
// (A camera looks down its own -Z by convention, so "forward" and the matrix's third basis
// vector are not the same thing. That sign is where this usually goes wrong.)

import * as THREE from 'three';

export const CUBE_FACE_COUNT = 6;

const scratch = new THREE.Matrix4();

export const cubeFaceMatrix = (face: number, center: THREE.Vector3): THREE.Matrix4 => {
  // TODO(you): build the real thing.
  //
  //  1. Pick the direction this face looks at, and an "up" vector for it. Six pairs.
  //     The up vectors are not all the same, and +Y / -Y are the ones that need thought
  //     (looking straight up, which way is up?).
  //  2. Build an orthonormal basis (right, up, forward) from those two, then put it into a Matrix4
  //     together with `center` as the translation.
  //     THREE.Matrix4 has makeBasis() and lookAt() — lookAt() builds a rotation from (eye, target, up),
  //     which is most of the work. Using it is fine; knowing what it produces is the point.
  //  3. When 5 of 6 faces look wrong, the usual causes are: the -Z convention in step 1,
  //     a left/right handed basis (check the cross product order), or the up vector for +Y / -Y.
  //
  // Placeholder: the same orientation for every face, so the sketch runs and is visibly wrong.
  void face;
  return scratch.identity().setPosition(center);
};
