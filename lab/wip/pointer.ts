// One pointer, two gestures, told apart by how far it moved, not where it went down (docs/plans/active/wip.md):
// released within TAP_SLOP css px of where it was pressed -> a tap there; moved further -> a drag that turns the
// shape, from the moment it passes the slop. Extra fingers are ignored.
import { Quaternion, Vector3, type Object3D } from 'three/webgpu';

// Provisional (plan: 未確定事項).
const TAP_SLOP = 6;

const Y = new Vector3(0, 1, 0);
const X = new Vector3(1, 0, 0);
const turn = new Quaternion();

export const attachPointer = (canvas: HTMLCanvasElement, target: Object3D, onTap: (x: number, y: number) => void) => {
  let active: { id: number; x0: number; y0: number; x: number; y: number; dragging: boolean } | null = null;

  canvas.addEventListener('pointerdown', (event) => {
    if (active) return;
    canvas.setPointerCapture(event.pointerId);
    active = { id: event.pointerId, x0: event.clientX, y0: event.clientY, x: event.clientX, y: event.clientY, dragging: false };
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!active || event.pointerId !== active.id) return;
    if (!active.dragging && Math.hypot(event.clientX - active.x0, event.clientY - active.y0) > TAP_SLOP) active.dragging = true;
    if (active.dragging) {
      // Half a turn across the shorter side of the screen. Around world axes, so the drag direction on screen is
      // the direction the shape turns however it is already turned (the camera looks down -z, unrotated).
      const perPixel = Math.PI / Math.min(canvas.clientWidth, canvas.clientHeight);
      target.quaternion.premultiply(turn.setFromAxisAngle(Y, (event.clientX - active.x) * perPixel));
      target.quaternion.premultiply(turn.setFromAxisAngle(X, (event.clientY - active.y) * perPixel));
    }
    active.x = event.clientX;
    active.y = event.clientY;
  });
  const end = (event: PointerEvent, tapped: boolean) => {
    if (!active || event.pointerId !== active.id) return;
    if (tapped && !active.dragging) onTap(event.clientX, event.clientY);
    active = null;
  };
  canvas.addEventListener('pointerup', (event) => end(event, true));
  canvas.addEventListener('pointercancel', (event) => end(event, false));
};
