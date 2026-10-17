// The voxel world: an nx x h x nz box of cells. Nothing is solid; a cell is drawn only while something lights it.
//
// The only state is the floor's: a 2D wave over the bottom layer. A drop landing pushes the surface there, the
// wave spreads and interferes with the others, and a floor cell is as bright as its wave is high, either way.
// The rain above needs no cells of its own: a drop falls straight down one column at a constant speed, so how
// bright each cell of its trail is follows from how far it is behind the drop (rain.ts, voxels.ts).
import type { Params } from './params.ts';

export type World = {
  nx: number; // cells along x
  nz: number; // cells along z
  h: number; // cells along y; y = 0 is the floor
  wave: Float32Array; // nx * nz, index = z * nx + x: the floor's surface now
  wavePrev: Float32Array; // and one step ago
};

export const createWorld = (nx: number, h: number, nz: number): World => ({
  nx,
  nz,
  h,
  wave: new Float32Array(nx * nz),
  wavePrev: new Float32Array(nx * nz),
});

// A push on the floor at (x, z), spread over 3x3 cells. A single-cell push is all grid frequency: it comes
// out as a checkerboard instead of a ring.
const KERNEL = [
  [0.25, 0.5, 0.25],
  [0.5, 1, 0.5],
  [0.25, 0.5, 0.25],
];

export const push = (world: World, x: number, z: number, amount: number) => {
  const { nx, nz } = world;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const i = x + dx;
      const j = z + dz;
      if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
      world.wave[j * nx + i]! -= amount * KERNEL[dz + 1]![dx + 1]!;
    }
  }
};

// One step of the discrete 2D wave equation (leapfrog):
//   next = 2 * now - prev + c^2 * laplacian(now), then damped.
// waveSpeed is c^2 in cells^2 per step; above 0.5 the scheme blows up, which is why the knob stops there.
// Cells outside the floor read as 0, so the edges would reflect the wave, inverted. Reflections pile up
// under steady rain until the whole floor sloshes and no ring can be told apart (measured: 94% of the floor
// lit at 12 drops/s), so a border waveEdge cells wide damps harder toward the edge and soaks them up.
const stepWave = (world: World, params: Params) => {
  const { nx, nz, wave: now, wavePrev: prev } = world;
  const c2 = params.waveSpeed;
  const edge = params.waveEdge;
  for (let j = 0; j < nz; j++) {
    const ej = Math.min(j, nz - 1 - j);
    for (let i = 0; i < nx; i++) {
      const e = Math.min(i, nx - 1 - i, ej);
      const damping = params.waveDamping * (e < edge ? 0.8 + 0.2 * (e / edge) : 1);
      const k = j * nx + i;
      const u = now[k]!;
      const l = i > 0 ? now[k - 1]! : 0;
      const r = i < nx - 1 ? now[k + 1]! : 0;
      const d = j > 0 ? now[k - nx]! : 0;
      const t = j < nz - 1 ? now[k + nx]! : 0;
      // Written into prev, which is not read again for this cell: the two arrays then swap roles.
      prev[k] = (2 * u - prev[k]! + c2 * (l + r + d + t - 4 * u)) * damping;
    }
  }
  world.wave = prev;
  world.wavePrev = now;
};

export const stepWorld = (world: World, params: Params) => {
  for (let s = 0; s < params.waveSteps; s++) stepWave(world, params);
};
