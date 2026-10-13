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

// Reused, not reallocated: this is written from params every frame so the colour is a knob.
const COLOR = new THREE.Color();

// A soft disc for the head of each trail. Built as a DataTexture rather than from a canvas so that
// createFlow can also be called from a plain `node` script -- which is how the flow is verified, there
// being no way to drive a pointer from a headless browser.
const discTexture = (): THREE.DataTexture => {
  const N = 64;
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = (x + 0.5) / N - 0.5;
      const dy = (y + 0.5) / N - 0.5;
      const d = Math.min(1, Math.hypot(dx, dy) * 2);
      // Smoothstep in, then squared: a hard-edged disc reads as a sticker, this reads as a light.
      const a = (1 - d * d) ** 2;
      const k = (y * N + x) * 4;
      data[k] = 255;
      data[k + 1] = 255;
      data[k + 2] = 255;
      data[k + 3] = Math.round(a * 255);
    }
  }
  const texture = new THREE.DataTexture(data, N, N);
  texture.needsUpdate = true;
  return texture;
};

export type Flow = {
  'object': THREE.Group;
  'update': (deltaTime: number, plates: Plates, params: Params) => void;
  'dispose': () => void;
};

export const createFlow = (params: Params): Flow => {
  const count = Math.max(1, Math.floor(params['flowCount']));
  const size = params['size'];

  // Each particle's trail is a ribbon, not a row of dots: its recent positions are the spine, and every
  // spine sample carries two vertices offset perpendicular to the direction of travel. Drawing the history
  // as separate points was legible but read as a dotted line, which is not what a trail looks like.
  //
  // The ribbon lies flat in the ground plane, like the flow itself.
  const trail = Math.max(1, Math.floor(params['flowTrail']));
  const slots = trail + 1; // spine samples per particle
  const verts = count * slots * 2;

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(verts * 3);
  const colors = new Float32Array(verts * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // The index never changes -- only the vertices move -- so it is built once.
  const indices = new Uint32Array(count * (slots - 1) * 6);
  let w = 0;
  for (let i = 0; i < count; i++) {
    const base = i * slots * 2;
    for (let s = 0; s < slots - 1; s++) {
      const a0 = base + s * 2;
      indices[w++] = a0;
      indices[w++] = a0 + 1;
      indices[w++] = a0 + 2;
      indices[w++] = a0 + 1;
      indices[w++] = a0 + 3;
      indices[w++] = a0 + 2;
    }
  }
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  // Additive, so fading is just a dimmer colour -- there is no per-vertex alpha here, and against an
  // additive blend black IS transparent. toneMapped off keeps the trail above the bloom threshold.
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  const ribbon = new THREE.Mesh(geometry, material);
  ribbon.frustumCulled = false;

  // The head of each trail, as a camera-facing disc. Points always face the camera, so the billboard comes
  // for free -- no per-instance orientation to keep in sync with the ribbon.
  const headGeometry = new THREE.BufferGeometry();
  const headPositions = new Float32Array(count * 3);
  const headColors = new Float32Array(count * 3);
  headGeometry.setAttribute('position', new THREE.BufferAttribute(headPositions, 3));
  headGeometry.setAttribute('color', new THREE.BufferAttribute(headColors, 3));

  const disc = discTexture();
  const headMaterial = new THREE.PointsMaterial({
    map: disc,
    size: 1,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const heads = new THREE.Points(headGeometry, headMaterial);
  heads.frustumCulled = false;

  const group = new THREE.Group();
  group.add(ribbon);
  group.add(heads);

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

  // Where the stream enters and leaves. One number, so the spawn band, the kill test and the fade cannot
  // drift apart -- which is exactly how the stream broke before (see the lifetime note below).
  const BOUND = () => size * 0.85;

  // `scatter` fills the field at startup; otherwise the particle re-enters just outside the upstream edge.
  //
  // The band is thin and sits ON the edge, not in a deep reservoir upstream. A reservoir looks like it
  // would stagger arrivals, and it does -- but only if a particle lives long enough to cross it, and the
  // crossing time is set by the field size and the speed while the lifetime was a constant. Grow the
  // field and the two silently stop agreeing: particles start dying out of sight, and the few that make
  // it through arrive as a clump with an empty gap behind it. What actually keeps the stream steady is
  // that the population's phases are spread once, at startup, and then preserved -- each particle cycles
  // with the same period, so a spread set of phases stays spread.
  const spawn = (i: number, scatter: boolean) => {
    const a = angle();
    const dirX = Math.cos(a);
    const dirZ = Math.sin(a);
    const bound = BOUND();
    const across = (Math.random() - 0.5) * 2 * bound;
    const along = scatter ? (Math.random() * 2 - 1) * bound : bound + Math.random() * size * 0.05;
    px[i] = -dirX * along - dirZ * across;
    pz[i] = -dirZ * along + dirX * across;
    vx[i] = dirX * params['flowSpeed'];
    vz[i] = dirZ * params['flowSpeed'];
    // Lifetime in units of the crossing, not in seconds. At 1.0 a particle would reach the far edge
    // exactly as it expired; the spread above that means most are retired by leaving the frame and a few
    // turn over early, which is what keeps the population from marching in lockstep. A particle deflected
    // around a raised plate travels further than the straight crossing, so the headroom is not optional.
    const crossing = (2 * bound) / Math.max(params['flowSpeed'], 0.01);
    life[i] = crossing * (1.3 + Math.random() * 0.9);
    // Startup only: spread the phases, or every particle fades in on the same frame and the first thing
    // the viewer sees is one synchronised pulse.
    age[i] = scatter ? Math.random() * life[i]! : 0;
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
    COLOR.setHex(params['flowColor']);
    head = (head + 1) % slots;

    const dt = Math.min(deltaTime, 1 / 20); // a stalled tab must not teleport the whole stream
    const a = angle();
    const dirX = Math.cos(a);
    const dirZ = Math.sin(a);
    const speed = params['flowSpeed'];
    const push = params['flowPush'];
    const swirl = params['flowSwirl'];
    const bound = BOUND(); // the one place the edge is defined (see spawn)
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

      // Measured ALONG the flow, not from the origin. A radial bound kills particles that are still waiting
      // upstream, which forces them all back onto the same narrow spawn band and rebuilds the clumping the
      // staggered spawn exists to avoid.
      let downstream = px[i]! * dirX + pz[i]! * dirZ;
      let sideways = Math.abs(px[i]! * -dirZ + pz[i]! * dirX);
      if (age[i]! > life[i]! || downstream > bound || sideways > bound) {
        spawn(i, false);
        // Re-measure: the fade below is a function of position, so reading the position the particle had
        // before it was reborn would light it up at full brightness on its first frame back.
        downstream = px[i]! * dirX + pz[i]! * dirZ;
        sideways = Math.abs(px[i]! * -dirZ + pz[i]! * dirX);
      }

      hist[(i * slots + head) * 2] = px[i]!;
      hist[(i * slots + head) * 2 + 1] = pz[i]!;

      // Fade by POSITION in the field, not by age.
      //
      // Age-based fading made the look depend on three numbers that have no reason to agree -- lifetime,
      // speed and field size. It also could not fade a particle out at the edge it actually leaves by:
      // the kill test above is positional, so a particle retired at the boundary vanished at whatever
      // brightness its age happened to give it. Against the fogged far edge that reads as a pop.
      //
      // u runs 0 at the upstream edge to 1 at the downstream one; v is the sideways distance. The same
      // bound drives all three, so entering, leaving and dying are the same event by construction.
      const u = (downstream + bound) / (2 * bound);
      const v = sideways / bound;
      const fade =
        Math.max(0, Math.min(1, u * 8)) *
        Math.max(0, Math.min(1, (1 - u) * 8)) *
        Math.max(0, Math.min(1, (1 - v) * 8)) *
        params['flowBrightness'];
      const halfWidth = params['flowWidth'] / 2;
      const base = i * slots * 2;

      for (let s = 0; s < slots; s++) {
        // s = 0 is now, s = slots - 1 is the oldest sample in the ring.
        const at = (o: number) => (i * slots + ((head - o + slots * 2) % slots)) * 2;
        const here = at(s);
        // Direction of travel at this sample: from the older neighbour toward the newer one, clamped at the
        // ends so the head and tail use the segment they actually have.
        const ahead = at(Math.max(0, s - 1));
        const behind = at(Math.min(slots - 1, s + 1));
        let tx = hist[ahead]! - hist[behind]!;
        let tz = hist[ahead + 1]! - hist[behind + 1]!;
        const tl = Math.hypot(tx, tz);
        if (tl < 1e-6) {
          // Just spawned, or standing still: fall back to the velocity so the ribbon still has an axis.
          const vl = Math.hypot(vx[i]!, vz[i]!) || 1;
          tx = vx[i]! / vl;
          tz = vz[i]! / vl;
        } else {
          tx /= tl;
          tz /= tl;
        }

        // Taper to nothing at the tail. Squared, because a linear taper reads as a wedge, not a wake.
        const taper = (1 - s / slots) ** 2;
        const ox = -tz * halfWidth * taper;
        const oz = tx * halfWidth * taper;

        const x = hist[here]!;
        const z = hist[here + 1]!;
        // The stream runs ABOVE the static greeble and below whatever the pointer has raised. That is what
        // makes the raised plates the obstacles: at floor level the fixed blocks would hide the stream and
        // the interaction would be invisible.
        const y = params['flowAltitude'];
        const k = (base + s * 2) * 3;
        positions[k] = x + ox;
        positions[k + 1] = y;
        positions[k + 2] = z + oz;
        positions[k + 3] = x - ox;
        positions[k + 4] = y;
        positions[k + 5] = z - oz;

        const lit = fade * taper;
        for (let v = 0; v < 2; v++) {
          colors[k + v * 3] = COLOR.r * lit;
          colors[k + v * 3 + 1] = COLOR.g * lit;
          colors[k + v * 3 + 2] = COLOR.b * lit;
        }

        if (s === 0) {
          headPositions[i * 3] = x;
          headPositions[i * 3 + 1] = y;
          headPositions[i * 3 + 2] = z;
          headColors[i * 3] = COLOR.r * fade;
          headColors[i * 3 + 1] = COLOR.g * fade;
          headColors[i * 3 + 2] = COLOR.b * fade;
        }
      }
    }
    // Relative to the ribbon, not an absolute world size. The two were independent numbers, so narrowing
    // the ribbon left the cap behind at whatever size it had and the head stopped fitting the trail --
    // which is only ever visible as "the sizes do not match", never as a number being wrong. As a
    // multiple, one knob is the ribbon's width and the other is how far the cap overhangs it.
    //
    // The disc's alpha is (1 - d*d)^2, so its bright core is about 55% of the quad: a multiple near 1.8
    // puts the core flush with the ribbon, and anything above that reads as a glow around the head.
    headMaterial.size = params['flowWidth'] * params['flowHead'];
    geometry.getAttribute('position').needsUpdate = true;
    geometry.getAttribute('color').needsUpdate = true;
    headGeometry.getAttribute('position').needsUpdate = true;
    headGeometry.getAttribute('color').needsUpdate = true;
  };

  return {
    'object': group,
    'update': update,
    'dispose': () => {
      geometry.dispose();
      material.dispose();
      headGeometry.dispose();
      headMaterial.dispose();
      disc.dispose();
    },
  };
};
