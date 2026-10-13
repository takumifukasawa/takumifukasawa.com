// Streaks crossing the field, going around whatever the pointer has raised.
//
// Not a fluid solver. A solver would spend its whole budget being correct about pressure, and what reads on
// screen is simpler than that: a steady drift plus two terms derived from the obstacle field -- one pushing
// away from rising ground, one running along its contour. The second is what turns "shoved aside" into
// "flowed around"; without it the streaks bounce off the obstacle and the result looks like a force field.
//
// The obstacle is the actual lift of the actual plates, rasterised into a coarse grid each frame. Using a
// smooth bump around the pointer instead would be cheaper, but the moment the pointer moves faster than the
// plates settle, the obstacle and the raised blocks part company and the streaks avoid empty floor.
//
// Stateful: positions are integrated. This is where the sketch stopped being a loop, along with lift.ts.
import * as THREE from 'three';
import type { Plates } from './lift.ts';
import type { Params } from './params.ts';

// Coarse on purpose. The flow should feel the mass of a raised area, not its individual panels; a fine grid
// would make streaks weave between single blocks, which reads as noise.
const GRID = 48;

const COLOR = new THREE.Color(0x6fc8ff);

export type Flow = {
  'object': THREE.Points;
  'update': (deltaTime: number, plates: Plates, params: Params) => void;
  'dispose': () => void;
};

export const createFlow = (params: Params): Flow => {
  const count = Math.max(1, Math.floor(params['flowCount']));
  const size = params['size'];

  // A trail is the particle's own recent positions, drawn as dimmer points -- not a line, so the look stays
  // a point cloud. SLOTS is a ring buffer per particle, with the newest at `head`.
  const trail = Math.max(0, Math.floor(params['flowTrail']));
  const slots = trail + 1;
  const drawn = count * slots;

  // Points, not stretched quads. A point has no orientation to get wrong and no winding to flip, and the
  // position buffer is three floats per point instead of a sixteen-float matrix.
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(drawn * 3);
  const colors = new Float32Array(drawn * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Additive, so fading is just a dimmer colour -- there is no per-vertex alpha on PointsMaterial, and
  // against an additive blend black IS transparent. toneMapped off keeps them above the bloom threshold.
  const material = new THREE.PointsMaterial({
    size: 1,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  const px = new Float32Array(count);
  const pz = new Float32Array(count);
  const vx = new Float32Array(count);
  const vz = new Float32Array(count);
  const age = new Float32Array(count);
  const life = new Float32Array(count);
  // x,z of the last `slots` positions of each particle. Altitude is constant, so it is not stored.
  const hist = new Float32Array(count * slots * 2);
  let head = 0;

  const field = new Float32Array(GRID * GRID);

  const angle = () => (params['flowAngle'] * Math.PI) / 180;

  // Spawn along the upstream edge, spread across the width of the field, at a random distance back so the
  // stream does not arrive as a wavefront.
  const spawn = (i: number, scatter: boolean) => {
    const a = angle();
    const dirX = Math.cos(a);
    const dirZ = Math.sin(a);
    const half = size * 0.72;
    const across = (Math.random() - 0.5) * 2 * half;
    const along = scatter ? Math.random() * 2 * half : half * (1 + Math.random() * 0.1);
    px[i] = -dirX * along - dirZ * across;
    pz[i] = -dirZ * along + dirX * across;
    vx[i] = dirX * params['flowSpeed'];
    vz[i] = dirZ * params['flowSpeed'];
    age[i] = 0;
    life[i] = 6 + Math.random() * 6;
    // Collapse the whole history onto the new position. Without this the trail draws a line from wherever
    // the particle died to wherever it was reborn, straight across the field.
    for (let s = 0; s < slots; s++) {
      hist[(i * slots + s) * 2] = px[i]!;
      hist[(i * slots + s) * 2 + 1] = pz[i]!;
    }
  };

  for (let i = 0; i < count; i++) spawn(i, true);

  const rasterise = (plates: Plates) => {
    field.fill(0);
    const half = size / 2;
    const toCell = GRID / size;
    for (let p = 0; p < plates['count']; p++) {
      const amount = plates['lift'][p]!;
      if (amount < 0.01) continue;
      // Pad by one cell so the obstacle has a shoulder to deflect against instead of a cliff.
      const pad = size / GRID;
      const x0 = plates['cx'][p]! - plates['w'][p]! / 2 - pad;
      const x1 = plates['cx'][p]! + plates['w'][p]! / 2 + pad;
      const z0 = plates['cz'][p]! - plates['d'][p]! / 2 - pad;
      const z1 = plates['cz'][p]! + plates['d'][p]! / 2 + pad;
      const i0 = Math.max(0, Math.floor((x0 + half) * toCell));
      const i1 = Math.min(GRID - 1, Math.floor((x1 + half) * toCell));
      const j0 = Math.max(0, Math.floor((z0 + half) * toCell));
      const j1 = Math.min(GRID - 1, Math.floor((z1 + half) * toCell));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const k = j * GRID + i;
          if (amount > field[k]!) field[k] = amount;
        }
      }
    }
  };

  const sample = (x: number, z: number): number => {
    const half = size / 2;
    const fi = Math.min(GRID - 1, Math.max(0, Math.floor((x + half) * (GRID / size))));
    const fj = Math.min(GRID - 1, Math.max(0, Math.floor((z + half) * (GRID / size))));
    return field[fj * GRID + fi]!;
  };

  const update = (deltaTime: number, plates: Plates, params: Params) => {
    rasterise(plates);
    head = (head + 1) % slots;

    const dt = Math.min(deltaTime, 1 / 20); // a stalled tab must not teleport the whole stream
    const a = angle();
    const dirX = Math.cos(a);
    const dirZ = Math.sin(a);
    const speed = params['flowSpeed'];
    const push = params['flowPush'];
    const swirl = params['flowSwirl'];
    const bound = size * 0.85;
    const step = size / GRID;

    for (let i = 0; i < count; i++) {
      // Central differences on the obstacle field: the gradient points uphill.
      const gx = (sample(px[i]! + step, pz[i]!) - sample(px[i]! - step, pz[i]!)) / (2 * step);
      const gz = (sample(px[i]!, pz[i]! + step) - sample(px[i]!, pz[i]! - step)) / (2 * step);
      const gm = Math.hypot(gx, gz);

      let nvx = dirX;
      let nvz = dirZ;

      if (gm > 1e-5) {
        // The gradient is NORMALISED before use, so push and swirl are multiples of the base flow rather
        // than of whatever magnitude the field happens to have. Using the raw gradient made the repulsion
        // about six times the drift: particles were flung out, drifted back, and piled into a knot on the
        // obstacle's edge -- which looks like attraction, the exact opposite of the intent.
        const nx = gx / gm;
        const nz = gz / gm;
        // Only deflect where there is something to deflect around. `gm * step` is the rise across one cell,
        // which is what makes the shoulder of the obstacle act before the particle is inside it.
        const w = Math.min(1, sample(px[i]!, pz[i]!) + gm * step);
        // Contour direction, turned so it carries the particle downstream rather than back into the flow.
        const side = Math.sign(dirX * nz - dirZ * nx) || 1;
        nvx += (-nx * push + -nz * side * swirl) * w;
        nvz += (-nz * push + nx * side * swirl) * w;
      }

      // Hold the speed constant: the deflection is about direction, and letting it change the pace makes
      // the stream bunch up in front of an obstacle like traffic.
      const len = Math.hypot(nvx, nvz) || 1;
      nvx = (nvx / len) * speed;
      nvz = (nvz / len) * speed;

      // Ease toward the new direction so a streak curves instead of snapping.
      const turn = 1 - Math.exp(-params['flowTurn'] * dt);
      vx[i] = vx[i]! + (nvx - vx[i]!) * turn;
      vz[i] = vz[i]! + (nvz - vz[i]!) * turn;

      px[i] = px[i]! + vx[i]! * dt;
      pz[i] = pz[i]! + vz[i]! * dt;
      age[i] = age[i]! + dt;

      if (age[i]! > life[i]! || Math.abs(px[i]!) > bound || Math.abs(pz[i]!) > bound) spawn(i, false);

      hist[(i * slots + head) * 2] = px[i]!;
      hist[(i * slots + head) * 2 + 1] = pz[i]!;

      // Fade in and out at the ends of the life, or points appear and vanish as hard pops.
      const t = age[i]! / life[i]!;
      const fade = Math.min(1, t * 6) * Math.min(1, (1 - t) * 4) * params['flowBrightness'];

      for (let s = 0; s < slots; s++) {
        // s = 0 is now, s = slots - 1 is the oldest sample in the ring.
        const src = (head - s + slots) % slots;
        const k = (i * slots + s) * 3;
        // The stream runs ABOVE the static greeble and below whatever the pointer has raised. That is what
        // makes the raised plates the obstacles: at floor level the fixed blocks would hide the stream and
        // the interaction would be invisible.
        positions[k] = hist[(i * slots + src) * 2]!;
        positions[k + 1] = params['flowAltitude'];
        positions[k + 2] = hist[(i * slots + src) * 2 + 1]!;

        // Squared falloff: a linear tail reads as a dotted line of equals, a squared one as a trail.
        const tail = slots === 1 ? 1 : (1 - s / slots) ** 2;
        colors[k] = COLOR.r * fade * tail;
        colors[k + 1] = COLOR.g * fade * tail;
        colors[k + 2] = COLOR.b * fade * tail;
      }
    }
    material.size = params['flowSize'];
    geometry.getAttribute('position').needsUpdate = true;
    geometry.getAttribute('color').needsUpdate = true;
  };

  return {
    'object': points,
    'update': update,
    'dispose': () => {
      geometry.dispose();
      material.dispose();
    },
  };
};
