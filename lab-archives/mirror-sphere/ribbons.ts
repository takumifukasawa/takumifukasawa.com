// One instanced geometry holding every ribbon. All of the shape lives in ribbon.vert.glsl; this only
// lays out the attributes.
//
// Instanced: the strip itself (s along the ribbon, side across it) is one small buffer shared by
// every ribbon, and the per-ribbon constants are instance attributes. The first version baked those
// constants into every vertex, which costs ~48 bytes per vertex and grows with count × segments —
// at a few thousand ribbons that is tens of megabytes for data that is constant per ribbon. Here the
// strip is ~1.5 KB total and each extra ribbon costs 40 bytes.
//
// The shader does not change: three feeds instance attributes under the same names.

import * as THREE from 'three';

const SEGMENTS = 96;

export type RibbonOptions = {
  count: number;
  emitWindow: number;
  tailMin: number;
  tailMax: number;
};

export const defaultRibbonOptions: RibbonOptions = {
  count: 260,
  // How far back the shed times are spread, in phase. Spreading them over the whole loop makes the
  // trails cover the entire path and the emitter stops reading as a source; keeping them recent is
  // what makes the swarm trail *behind* the point.
  emitWindow: 0.30,
  tailMin: 0.05,
  tailMax: 0.18,
};

// Deterministic: the same ribbons on every run and every machine, so the recording is reproducible.
//
// A per-ribbon stream rather than fract(sin(seed + k) * big) with a different k per field. That
// trick reuses one sequence and only shifts the input, so ribbon r's tilt is ribbon (r+40)'s phase
// offset — the parameters end up correlated and the ribbons visibly bunch into knots. Decorrelating
// them was the difference between a swarm and a few braids.
const makeRng = (seed: number) => {
  let a = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Warm-up. Seeded from 1, 2, 3, … the first output still carries the shape of the seed, so the
  // first value drawn (the tilt) came out correlated across ribbons and they bunched into two
  // bundles. Three throwaway draws is enough to lose it.
  next();
  next();
  next();
  return next;
};

// The strip: s from head to tail, two edges. Shared by every ribbon.
const createStrip = () => {
  const aS: number[] = [];
  const aSide: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const s = i / SEGMENTS;
    aS.push(s, s);
    aSide.push(-1, 1);
  }
  for (let i = 0; i < SEGMENTS; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  return { aS, aSide, index };
};

// Per-ribbon constants, one set per instance.
const createInstances = (options: RibbonOptions) => {
  const aDir: number[] = [];
  const aParams: number[] = [];

  for (let r = 0; r < options.count; r++) {
    const rnd = makeRng(r + 1);

    // Direction this ribbon drifts away from the emitter's path as it ages. Uniform on the sphere:
    // acos(1 - 2t) rather than t * PI, otherwise the directions bunch at the poles — very visible
    // once there are hundreds of them.
    const theta = Math.acos(1 - 2 * rnd());
    const phi = rnd() * Math.PI * 2;
    aDir.push(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi));

    aParams.push(
      rnd() * options.emitWindow, // when this ribbon was shed. Also the per-ribbon hue seed.
      options.tailMin + rnd() * (options.tailMax - options.tailMin), // tail length, in phase
      0.4 + rnd() * 0.6, // how far it drifts
      0.65 + rnd() * 0.35, // pull scale, so they do not all react identically
    );
  }

  return { aDir, aParams };
};

export const createRibbonGeometry = (options: RibbonOptions) => {
  const strip = createStrip();
  const instances = createInstances(options);

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('aS', new THREE.Float32BufferAttribute(strip.aS, 1));
  geometry.setAttribute('aSide', new THREE.Float32BufferAttribute(strip.aSide, 1));
  geometry.setAttribute('aDir', new THREE.InstancedBufferAttribute(new Float32Array(instances.aDir), 3));
  geometry.setAttribute('aParams', new THREE.InstancedBufferAttribute(new Float32Array(instances.aParams), 4));
  geometry.setIndex(strip.index);
  geometry.instanceCount = options.count;
  // The vertex shader moves vertices far from wherever three would infer bounds from, so the
  // bounding sphere has to be stated. Without it the ribbons get frustum-culled at random angles.
  // Generous: the shader moves vertices far from anything three could infer, and the emitter path
  // plus the drift can reach well beyond the shell.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8);
  return geometry;
};
