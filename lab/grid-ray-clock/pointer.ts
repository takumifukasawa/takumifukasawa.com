// The pointer, as a push on the camera that stays where it is left. Mouse: wherever the cursor is. Touch: each
// drag moves the camera on from where the last one left it -- a phone has no hover, so there is nothing to
// follow between drags, and snapping back on lift undid every gesture.
//
// Normalised to -1..1 and eased toward, so the camera follows rather than snaps.
export type Pointer = { 'x': number; 'y': number; 'update': (deltaTime: number, rate: number) => void };

export const createPointer = (target: HTMLElement): Pointer => {
  let goalX = 0;
  let goalY = 0;
  // Touch is relative: a drag adds to wherever the camera already is, and a third of the screen is the
  // full range. Absolute, like the mouse, a finger landing near the middle -- where people touch -- moved
  // nothing.
  let startX = 0;
  let startY = 0;
  let baseX = 0;
  let baseY = 0;
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const aim = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') {
      goalX = (event.clientX / window.innerWidth) * 2 - 1;
      goalY = (event.clientY / window.innerHeight) * 2 - 1;
    } else {
      goalX = clamp(baseX + ((event.clientX - startX) / window.innerWidth) * 3);
      goalY = clamp(baseY + ((event.clientY - startY) / window.innerHeight) * 3);
    }
  };
  target.addEventListener('pointerdown', (event) => {
    startX = event.clientX;
    startY = event.clientY;
    baseX = goalX;
    baseY = goalY;
    aim(event);
  });
  target.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse' || event.buttons !== 0) aim(event);
  });

  const pointer: Pointer = {
    'x': 0,
    'y': 0,
    'update': (deltaTime, rate) => {
      // Frame-rate independent exponential approach.
      const k = 1 - Math.exp(-rate * deltaTime);
      pointer['x'] += (goalX - pointer['x']) * k;
      pointer['y'] += (goalY - pointer['y']) * k;
    },
  };
  return pointer;
};
