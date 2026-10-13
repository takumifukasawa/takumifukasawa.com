// Where the pointer is, in world coordinates on the ground plane.
//
// A ray from the camera through the pointer, intersected with y = 0. Doing it this way rather than with an
// inverse projection means the answer stays correct when the camera moves, which it does every frame.
import * as THREE from 'three';

export type Pointer = {
  'x': number;
  'z': number;
  'active': boolean;
};

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();

export const createPointer = (canvas: HTMLCanvasElement, camera: THREE.Camera): Pointer => {
  const pointer: Pointer = { 'x': 0, 'z': 0, 'active': false };

  const track = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    // A ray parallel to the ground never meets it; keep the last position rather than jumping to infinity.
    if (!ray.ray.intersectPlane(ground, hitPoint)) return;
    pointer['x'] = hitPoint.x;
    pointer['z'] = hitPoint.z;
    pointer['active'] = true;
  };

  // pointer* rather than mouse*: one set of events covers mouse, touch and pen. The sketch's CSS already
  // sets touch-action: none, without which a drag on a phone becomes a browser gesture and never arrives.
  canvas.addEventListener('pointermove', track);
  canvas.addEventListener('pointerdown', track);
  canvas.addEventListener('pointerleave', () => (pointer['active'] = false));
  canvas.addEventListener('pointercancel', () => (pointer['active'] = false));

  return pointer;
};
