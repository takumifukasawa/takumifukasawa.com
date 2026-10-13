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

export type Flow = {
  'mesh': THREE.InstancedMesh;
  'update': (deltaTime: number, plates: Plates, params: Params) => void;
  'dispose': () => void;
};

export const createFlow = (params: Params): Flow => {
  const count = Math.max(1, Math.floor(params['flowCount']));
  const size = params['size'];

  // Lying flat in the ground plane, with the quad hanging BEHIND its origin (x from -1 to 0) so the streak
  // trails the particle. Doing it in the geometry rather than with a negative scale matters: a negative
  // scale flips the winding and the quad is back-face culled, which is a very convincing way to render
  // 2500 invisible particles.
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(-0.5, 0, 0);

  // Additive and well past 1.0, so the streaks sit above the bloom threshold and read as light rather than
  // as pale paint. depthWrite off because they overlap constantly and sorting 2500 of them is not worth it.
  const material = new THREE.MeshBasicMaterial({
    color: 0x6fc8ff,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;

  const px = new Float32Array(count);
  const pz = new Float32Array(count);
  const vx = new Float32Array(count);
  const vz = new Float32Array(count);
  const age = new Float32Array(count);
  const life = new Float32Array(count);

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

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  const update = (deltaTime: number, plates: Plates, params: Params) => {
    rasterise(plates);

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

      // Contour direction, turned so it always carries the streak downstream rather than back into the flow.
      const side = Math.sign(dirX * gz - dirZ * gx) || 1;
      const tx = -gz * side;
      const tz = gx * side;

      let nvx = dirX * speed - gx * push * speed + tx * swirl * speed;
      let nvz = dirZ * speed - gz * push * speed + tz * swirl * speed;

      // Hold the speed roughly constant: the deflection is about direction, and letting it change the pace
      // makes the stream bunch up in front of an obstacle like traffic.
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

      const heading = Math.atan2(vz[i]!, vx[i]!);
      quaternion.setFromAxisAngle(up, -heading);
      // The stream runs ABOVE the static greeble and below whatever the pointer has raised. That is what
      // makes the raised plates the obstacles: at floor level the fixed blocks would hide the stream and
      // the interaction would be invisible.
      position.set(px[i]!, params['flowAltitude'], pz[i]!);
      // Fade in and out at the ends of the life, or streaks appear and vanish as hard pops.
      const t = age[i]! / life[i]!;
      const fade = Math.min(1, t * 6) * Math.min(1, (1 - t) * 4);
      scale.set(params['flowLength'] * fade, 1, params['flowWidth'] * fade);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  return {
    'mesh': mesh,
    'update': update,
    'dispose': () => {
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
};
