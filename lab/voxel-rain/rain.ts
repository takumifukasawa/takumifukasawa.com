// Raindrops. Each falls straight down one column of cells at a constant speed, from above the box to the
// floor. Reaching the floor it pushes the wave, and keeps falling below it, unseen, until the last of its
// trail has faded: the trail is drawn from the drop's height (voxels.ts), so the drop has to outlive it.
import type { Params } from './params.ts';
import { push, type World } from './world.ts';

export type Rain = {
  count: number;
  x: Int16Array; // the column
  z: Int16Array;
  y: Float32Array; // height of the drop's head, in cells
  force: Float32Array; // how hard it pushes the floor; 0 once it has
  trail: Float32Array; // its trail's length, as a multiple of trailLife
  top: Float32Array; // the height it appeared at: it has no trail above that
  acc: number;
};

export const RAIN_CAPACITY = 2048;

export const createRain = (): Rain => ({
  count: 0,
  x: new Int16Array(RAIN_CAPACITY),
  z: new Int16Array(RAIN_CAPACITY),
  y: new Float32Array(RAIN_CAPACITY),
  force: new Float32Array(RAIN_CAPACITY),
  trail: new Float32Array(RAIN_CAPACITY),
  top: new Float32Array(RAIN_CAPACITY),
  acc: 0,
});

export const drop = (rain: Rain, x: number, z: number, y: number, force: number, trail = 1) => {
  if (rain.count >= RAIN_CAPACITY) return;
  const k = rain.count++;
  rain.x[k] = x;
  rain.z[k] = z;
  rain.y[k] = y;
  rain.force[k] = force;
  rain.trail[k] = trail;
  rain.top[k] = y;
};

const kill = (rain: Rain, k: number) => {
  const last = --rain.count;
  rain.x[k] = rain.x[last]!;
  rain.z[k] = rain.z[last]!;
  rain.y[k] = rain.y[last]!;
  rain.force[k] = rain.force[last]!;
  rain.trail[k] = rain.trail[last]!;
  rain.top[k] = rain.top[last]!;
};

// Where a drop falls is chosen by the caller (main.ts): a column under a random point of the screen, so the rain
// is even on screen rather than on the floor, most of which is off screen or far away and squeezed small.
export type Column = { x: number; z: number } | null;

export const stepRain = (rain: Rain, world: World, deltaTime: number, params: Params, column: () => Column) => {
  const { h } = world;
  rain.acc += params.rainRate * deltaTime;
  while (rain.acc >= 1) {
    rain.acc -= 1;
    const c = column();
    if (!c) continue;
    // Start a little above the box, spread over one step's fall so a step's drops do not enter as a sheet.
    drop(
      rain,
      c.x,
      c.z,
      h + Math.random() * params.dropSpeed * deltaTime,
      params.impulse * (1 - params.impulseSpread * Math.random()),
      1 + params.trailSpread * (Math.random() * 2 - 1),
    );
  }

  const fall = params.dropSpeed * deltaTime;
  // Gone once even the cell just above the floor is 6 of its trail's lifetimes old: e^-6 of full brightness.
  const gone = -6 * params.trailLife * params.dropSpeed;
  for (let k = rain.count - 1; k >= 0; k--) {
    const y = rain.y[k]! - fall;
    rain.y[k] = y;
    if (y < 1 && rain.force[k]! > 0) {
      push(world, rain.x[k]!, rain.z[k]!, rain.force[k]!);
      rain.force[k] = 0;
    }
    if (y < gone * rain.trail[k]!) kill(rain, k);
  }
};
