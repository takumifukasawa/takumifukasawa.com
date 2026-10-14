// How far each plate has risen toward the pointer.
//
// Per PLATE, not per leaf. The leaves of a plate already share a height so that they read as one panel
// (subdivide.ts); lifting them independently would tear that panel apart at exactly the moment the eye is
// looking straight at it.
//
// This is the first part of the sketch that is NOT a phase function: the rise and the settle are
// integrated, so the piece no longer closes into an exact loop (decision 0005). That is the right trade
// here -- a thing driven by a pointer cannot be a loop in the first place, and easing is what makes the
// response read as mass rather than as a switch.
import type { Cell, Rect } from './subdivide.ts';
import type { Params } from './params.ts';
import type { Pointer } from './pointer.ts';

export type Plates = {
  'count': number;
  'cx': Float32Array; // plate centre, in domain units
  'cz': Float32Array;
  'w': Float32Array; // and its extent, so the flow can rasterise the raised ones as obstacles
  'd': Float32Array;
  'lift': Float32Array; // 0 at rest, 1 fully raised
  'indexOf': (cell: Cell) => number;
};

const key = (plate: Rect) => `${plate.x},${plate.z},${plate.w},${plate.d}`;

export const collectPlates = (cells: Cell[]): Plates => {
  const index = new Map<string, number>();
  const cx: number[] = [];
  const cz: number[] = [];
  const w: number[] = [];
  const d: number[] = [];

  for (const cell of cells) {
    const k = key(cell.plate);
    if (index.has(k)) continue;
    index.set(k, cx.length);
    cx.push(cell.plate.x + cell.plate.w / 2);
    cz.push(cell.plate.z + cell.plate.d / 2);
    w.push(cell.plate.w);
    d.push(cell.plate.d);
  }

  return {
    'count': cx.length,
    'cx': Float32Array.from(cx),
    'cz': Float32Array.from(cz),
    'w': Float32Array.from(w),
    'd': Float32Array.from(d),
    'lift': new Float32Array(cx.length),
    'indexOf': (cell) => index.get(key(cell.plate)) ?? 0,
  };
};

// Returns the largest change any plate made this frame. The caller uses it to decide whether the field
// moved at all -- with autoGrow off, a settled field is perfectly static, and everything downstream of it
// (the instance matrices, the shadow map) can be left exactly as it was.
export const updateLift = (plates: Plates, deltaTime: number, pointer: Pointer, params: Params): number => {
  // Plate centres are in domain units and the pointer is in world units, but createPlaneSurface maps the
  // domain onto the ground 1:1 (u = x/size + 0.5), so on the plane the two scales are the same number.
  // A curved surface would need a projection here.
  const px = pointer['x'];
  const pz = pointer['z'];
  const radius = params['liftRadius'];
  const falloff = 1 / Math.max(radius, 1e-6);

  // Framerate-independent easing. A plain lerp by a constant factor would rise faster on a fast machine,
  // which is the kind of difference that only shows up on someone else's phone.
  const rise = 1 - Math.exp(-params['liftRise'] * deltaTime);
  const fall = 1 - Math.exp(-params['liftFall'] * deltaTime);

  let moved = 0;
  for (let i = 0; i < plates['count']; i++) {
    let target = 0;
    if (pointer['active']) {
      const dx = plates['cx'][i]! - px;
      const dz = plates['cz'][i]! - pz;
      const t = Math.max(0, 1 - Math.hypot(dx, dz) * falloff);
      // Smoothstep, so the edge of the raised area is a shoulder rather than a cone.
      target = t * t * (3 - 2 * t);
    }
    const current = plates['lift'][i]!;
    const next = current + (target - current) * (target > current ? rise : fall);
    // Exponential easing approaches its target but never arrives, so it would report movement forever.
    // Snap the last sliver shut: below this the plate has moved less than a thousandth of its travel and
    // nothing downstream can show the difference.
    plates['lift'][i] = Math.abs(next - target) < 1e-4 ? target : next;
    moved = Math.max(moved, Math.abs(plates['lift'][i]! - current));
  }
  return moved;
};
