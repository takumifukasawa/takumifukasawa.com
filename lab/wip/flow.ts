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
  // Per-particle -1..1, rerolled at each respawn: how much harder or softer this one is pushed and turned
  // than the knobs say (flowJitter). Identical particles in the same spot take identical paths; a little
  // spread fans a converging stream out instead of letting it settle onto one line.
  const varyPush = new Float32Array(count);
  const varySwirl = new Float32Array(count);
  // Which way round the current obstacle this particle goes: +1 / -1, 0 while it is in the open. Decided
  // once on arrival and held until it is clear. Re-deciding every frame from the local gradient is what made
  // a particle meeting an obstacle head-on twitch left and right: dead ahead, the sign flips with any noise.
  const sideOf = new Int8Array(count);
  // How lit up this particle is by its own turning, 0..1 (flowGlow). Kept per particle and eased rather
  // than computed fresh each frame: the turn rate is a per-frame difference of headings and is noisy, so
  // used raw it flickers -- and bloom amplifies flicker (post.ts). Rises fast, fades over flowGlowDecay,
  // so a streak flares as it bends round a plate and carries the light a little way downstream.
  const glow = new Float32Array(count);
  // x,z of the last `slots` positions of each particle. Altitude is constant, so it is not stored.
  const hist = new Float32Array(count * slots * 2);
  let head = 0;

  const field = new Float32Array(GRID * GRID);

  // Separation: a bucket grid rebuilt every frame (counting sort), so finding the neighbours within the
  // radius is a look at 3x3 buckets instead of every other particle. Sized lazily, because the bucket
  // count depends on bound and the radius, both of them live.
  const snapX = new Float32Array(count); // positions at the start of the frame: every particle reacts to
  const snapZ = new Float32Array(count); // the same snapshot, whatever order the loop updates them in
  const sorted = new Int32Array(count);
  const bucketOf = new Int32Array(count);
  let bucketStart = new Int32Array(1);
  let bucketCount = new Int32Array(1);

  const angle = () => (params['flowAngle'] * Math.PI) / 180;

  // Where the stream enters and leaves. One number, so the spawn band, the kill test and the fade cannot
  // drift apart -- which is exactly how the stream broke before (see the lifetime note below).
  //
  // A knob because the camera sees a small part of the floor: at the old fixed 0.85 only ~8% of the
  // particles were ever on screen, so most of the CPU time and the per-frame upload went to streaks nobody
  // could see. Read live, so shrinking it retires the particles that end up outside on their next step.
  const BOUND = () => size * params['flowExtent'];

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
    varyPush[i] = Math.random() * 2 - 1;
    varySwirl[i] = Math.random() * 2 - 1;
    sideOf[i] = 0;
    glow[i] = 0;
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

    // Bucket the particles for separation. Buckets are one radius wide, so every neighbour within the
    // radius is in the 3x3 block around a particle's own bucket.
    const sepRadius = Math.max(params['flowSeparateRadius'], 0.01);
    const sepStrength = params['flowSeparate'];
    // How many neighbours a particle would have within the radius if the stream were spread evenly. The
    // separation only acts on crowding ABOVE this (see the loop): applied everywhere, it kept every streak
    // weaving against the random spacing of its neighbours, and the straight stream turned into hair.
    const expected = Math.max((count / (4 * bound * bound)) * Math.PI * sepRadius * sepRadius, 0.5);
    // Particles just respawned sit slightly outside the bound (spawn band), so the grid is padded by one
    // bucket and indices are clamped rather than trusted.
    const B = Math.max(1, Math.min(512, Math.ceil((2 * bound) / sepRadius) + 2));
    if (bucketStart.length !== B * B + 1) {
      bucketStart = new Int32Array(B * B + 1);
      bucketCount = new Int32Array(B * B);
    }
    const bucketIndex = (x: number, z: number) => {
      const bi = Math.min(B - 1, Math.max(0, Math.floor((x + bound) / sepRadius) + 1));
      const bj = Math.min(B - 1, Math.max(0, Math.floor((z + bound) / sepRadius) + 1));
      return bj * B + bi;
    };
    if (sepStrength > 0) {
      bucketCount.fill(0);
      for (let i = 0; i < count; i++) {
        snapX[i] = px[i]!;
        snapZ[i] = pz[i]!;
        const b = bucketIndex(px[i]!, pz[i]!);
        bucketOf[i] = b;
        bucketCount[b] = bucketCount[b]! + 1;
      }
      bucketStart[0] = 0;
      for (let b = 0; b < B * B; b++) bucketStart[b + 1] = bucketStart[b]! + bucketCount[b]!;
      bucketCount.fill(0); // reused as the fill cursor
      for (let i = 0; i < count; i++) {
        const b = bucketOf[i]!;
        sorted[bucketStart[b]! + bucketCount[b]!] = i;
        bucketCount[b] = bucketCount[b]! + 1;
      }
    }

    for (let i = 0; i < count; i++) {
      // Central differences on the obstacle field: the gradient points uphill.
      const gx = (sample(px[i]! + step, pz[i]!) - sample(px[i]! - step, pz[i]!)) / (2 * step);
      const gz = (sample(px[i]!, pz[i]! + step) - sample(px[i]!, pz[i]! - step)) / (2 * step);
      const gm = Math.hypot(gx, gz);

      let nvx = dirX;
      let nvz = dirZ;
      // The way round the current obstacle, for the fallback below; the drift itself in the open.
      let tx = dirX;
      let tz = dirZ;

      if (gm > 1e-5) {
        // The gradient is NORMALISED before use, so push and swirl are multiples of the base flow rather
        // than of whatever magnitude the field happens to have. Using the raw gradient made the repulsion
        // about six times the drift: particles were flung out, drifted back, and piled into a knot on the
        // obstacle's edge -- which looks like attraction, the exact opposite of the intent.
        const nx = gx / gm;
        const nz = gz / gm;
        // Only deflect where there is something to deflect around. `gm * step` is the rise across one cell,
        // which is what makes the shoulder of the obstacle act before the particle is inside it.
        const inside = sample(px[i]!, pz[i]!);
        const w = Math.min(1, inside + gm * step);

        // A river round a stone: the water never turns back, it slides sideways along the stone's face.
        //
        // The old rule pushed straight out along -n. Head-on, -n points UPSTREAM, so the push cancelled the
        // drift (a stall) or beat it (a reversal), and after the speed was renormalised that came out as
        // particles hovering and wobbling in front of the obstacle -- measured: 16% reversing, 32% stalled,
        // 21 degrees of heading change per frame within 2 units of a raised plate. Now only the component
        // of the drift that heads INTO the obstacle is removed, and what is left (plus the contour term)
        // carries it round.
        if (sideOf[i] === 0) {
          // The contour direction is side * (-nz, nx); its component along the drift is -side * cross. So
          // the side that carries the particle DOWNSTREAM is the opposite sign of cross. (The previous
          // version had it the other way round and sent particles up the face of the obstacle -- hidden
          // behind a push that was strong enough to make everything near an obstacle chaotic anyway.)
          const cross = dirX * nz - dirZ * nx;
          // Dead ahead the cross product is noise, so a near-zero one takes the particle's own coin
          // instead: a head-on stream splits both ways rather than all turning the same way.
          sideOf[i] = Math.abs(cross) > 0.2 ? (cross > 0 ? -1 : 1) : varySwirl[i]! >= 0 ? 1 : -1;
        }
        const side = sideOf[i]!;
        const jitter = params['flowJitter'];
        const into = nvx * nx + nvz * nz;
        if (into > 0) {
          nvx -= nx * into * w;
          nvz -= nz * into * w;
        }
        tx = -nz * side;
        tz = nx * side;
        const sw = swirl * (1 + varySwirl[i]! * jitter) * w;
        nvx += -nz * side * sw;
        nvz += nx * side * sw;
        // Pushed out only once it is actually over the obstacle, never as a wall in front of it.
        const p = push * (1 + varyPush[i]! * jitter) * inside;
        nvx -= nx * p;
        nvz -= nz * p;
      } else {
        sideOf[i] = 0; // in the open: the next obstacle decides afresh
      }

      // Separation: steer away from neighbours, so streams that converge beside an obstacle stay side by
      // side instead of collapsing onto one line. Without it, a still pointer leaves the stream piled onto a
      // few lines -- one bin measured at 131x the mean density -- and those lines then repeat forever.
      //
      // Only the part ACROSS the current heading is used. Along the heading, the particle behind would be
      // steered backwards, and after the speed is renormalised below that is a U-turn, not a gap.
      if (sepStrength > 0) {
        let sx = 0;
        let sz = 0;
        let near = 0;
        const b = bucketOf[i]!;
        const bi = b % B;
        const bj = (b - bi) / B;
        for (let dj = -1; dj <= 1; dj++) {
          const nj = bj + dj;
          if (nj < 0 || nj >= B) continue;
          for (let di = -1; di <= 1; di++) {
            const ni = bi + di;
            if (ni < 0 || ni >= B) continue;
            const nb = nj * B + ni;
            for (let q = bucketStart[nb]!; q < bucketStart[nb + 1]!; q++) {
              const o = sorted[q]!;
              if (o === i) continue;
              const dx = snapX[i]! - snapX[o]!;
              const dz = snapZ[i]! - snapZ[o]!;
              const d2 = dx * dx + dz * dz;
              if (d2 >= sepRadius * sepRadius || d2 < 1e-12) continue;
              const d = Math.sqrt(d2);
              // Linear falloff to zero at the radius, so a neighbour drifting in or out of range does not
              // switch the force on with a jolt.
              const f = (1 - d / sepRadius) / d;
              sx += dx * f;
              sz += dz * f;
              near++;
            }
          }
        }
        const hl = Math.hypot(vx[i]!, vz[i]!) || 1;
        const hx = vx[i]! / hl;
        const hz = vz[i]! / hl;
        const along = sx * hx + sz * hz;
        // 0 up to 1.5x the even-spread count, ramping to full at 2.5x: open stream untouched, a pile-up
        // pushed apart.
        const crowd = Math.min(1, Math.max(0, (near - expected * 1.5) / expected));
        nvx += (sx - along * hx) * sepStrength * crowd;
        nvz += (sz - along * hz) * sepStrength * crowd;
      }

      // Never upstream. Every term above can point back against the drift in some configuration -- the
      // push on the front face of an obstacle (the grid is coarse, so a particle skimming the face already
      // counts as over it), the separation once a particle's heading has turned sideways -- and any of
      // them, renormalised, is a reversal. Measured with this off: 11% of particles near an obstacle
      // reversing, mostly from the push. So the backward component is removed outright, and if almost
      // nothing is left (pressed flat against the face) the particle takes the way round.
      const ahead = nvx * dirX + nvz * dirZ;
      if (ahead < 0) {
        nvx -= dirX * ahead;
        nvz -= dirZ * ahead;
      }
      if (Math.hypot(nvx, nvz) < 0.05) {
        nvx = tx;
        nvz = tz;
      }

      // Hold the speed constant: the deflection is about direction, and letting it change the pace makes
      // the stream bunch up in front of an obstacle like traffic.
      const len = Math.hypot(nvx, nvz) || 1;
      nvx = (nvx / len) * speed;
      nvz = (nvz / len) * speed;

      // Ease toward the new direction so a streak curves instead of snapping.
      const turn = 1 - Math.exp(-params['flowTurn'] * dt);
      const ovx = vx[i]!;
      const ovz = vz[i]!;
      vx[i] = ovx + (nvx - ovx) * turn;
      vz[i] = ovz + (nvz - ovz) * turn;

      // Glow from bending: the angle the heading swung through this frame, per second. It is the turn
      // itself that lights up, not proximity to an obstacle -- a streak sliding straight along a plate's
      // face stays dim, one being bent round its corner flares. Measured against flowGlowTurn (rad/s at
      // full glow) so the knob reads as "how sharp a bend counts as fully lit".
      if (params['flowGlow'] > 0) {
        const swung = Math.atan2(
          Math.abs(ovx * vz[i]! - ovz * vx[i]!),
          ovx * vx[i]! + ovz * vz[i]!,
        );
        const target = Math.min(1, swung / dt / Math.max(params['flowGlowTurn'], 1e-3));
        // Fast attack, slow release: the flare starts on the bend and trails off after it.
        const rate = target > glow[i]! ? 20 : 1 / Math.max(params['flowGlowDecay'], 1e-3);
        glow[i] = glow[i]! + (target - glow[i]!) * (1 - Math.exp(-rate * dt));
      } else {
        glow[i] = 0;
      }

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
        params['flowBrightness'] *
        (1 + glow[i]! * params['flowGlow']);
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
