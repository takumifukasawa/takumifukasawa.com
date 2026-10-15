// The lines. The clock is drawn standing; every second, each digit that changes is replaced whole: all the
// segments of its new value fly in from off screen and land exactly on the second, and all those of the
// old value fade in place. Unchanged digits stay still.
//
// Whole digits, not just the segments that differ: 8 -> 9 differs by one segment going OUT, so a
// per-segment diff sends nothing in at all and the change reads as a glitch rather than a tick.
//
// A "batch" is the set of incoming lines for one second. Batches are keyed by their arrival second (epoch seconds,
// an integer) and built the first time they are needed, so a change of layout or of any route knob applies
// from the next batch on without any transition code.
//
// Drawn as instanced quads, one per straight piece of a line: a line on screen is a short stretch of its
// route, which covers a corner or two at most, so a few hundred quads covers every line alive at once.
import * as THREE from 'three';
import { changedDigits, litSegments, type Layout, type Segment, type Vec2 } from './clock.ts';
import lineFrag from './line.frag.glsl?raw';
import lineVert from './line.vert.glsl?raw';
import type { Params } from './params.ts';
import { buildRoute, createRandom, type Route } from './route.ts';

const MAX_PIECES = 4096;

type Batch = { 'arrival': number; 'routes': Route[] };

export type Lines = {
  'mesh': THREE.Mesh;
  'update': (now: number, layout: Layout, bound: Vec2, params: Params) => void;
};

export const createLines = (): Lines => {
  const geometry = new THREE.InstancedBufferGeometry();
  // x: 0..1 along the piece, y: -1..1 across it.
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const from = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PIECES * 2), 2);
  const to = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PIECES * 2), 2);
  const alpha = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PIECES * 2), 2);
  // 1 = that end of the piece is pointed (the 45-degree tip of a 7-segment bar), 0 = square.
  const taper = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PIECES * 2), 2);
  const attributes = [from, to, alpha, taper];
  for (const attribute of attributes) attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aFrom', from);
  geometry.setAttribute('aTo', to);
  geometry.setAttribute('aAlpha', alpha);
  geometry.setAttribute('aTaper', taper);
  geometry.instanceCount = 0;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      'uWidth': { value: 0.1 },
      'uColor': { value: new THREE.Color() },
      'uBrightness': { value: 1 },
    },
    vertexShader: lineVert,
    fragmentShader: lineFrag,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false; // the quads are built in the vertex shader; the geometry's bounds mean nothing
  mesh.renderOrder = 1;

  const batches = new Map<number, Batch>();
  let count = 0;
  let halfWidth = 0;

  // One quad from arc length sa to sb of a route, alpha a0 -> a1. Corners are filled by stretching a piece
  // that runs INTO a corner by half the width and trimming the piece that runs OUT of it by the same, so the
  // corner square is covered exactly once (additive blending would show a double cover as a bright dot).
  // pointed: give the two ends of the range (s0 and s1, not the corners between) the 7-segment tip.
  const emit = (route: Route, s0: number, s1: number, a0: number, a1: number, pointed: boolean) => {
    if (s1 - s0 <= 1e-5 || a0 + a1 <= 0) return;
    const { points, lengths } = route;
    for (let i = 0; i < points.length - 1 && count < MAX_PIECES; i++) {
      const c0 = lengths[i]!;
      const c1 = lengths[i + 1]!;
      const sa = Math.max(s0, c0);
      const sb = Math.min(s1, c1);
      if (sb - sa <= 1e-5) continue;
      const p = points[i]!;
      const q = points[i + 1]!;
      const len = c1 - c0;
      const dx = (q[0] - p[0]) / len;
      const dy = (q[1] - p[1]) / len;
      const intoCorner = sb === c1 && i + 1 < points.length - 1 && s1 > c1;
      const outOfCorner = sa === c0 && i > 0 && s0 < c0;
      const ta = sa - c0 + (outOfCorner ? halfWidth : 0);
      const tb = sb - c0 + (intoCorner ? halfWidth : 0);
      if (tb - ta <= 1e-5) continue;
      const k = count * 2;
      from.array[k] = p[0] + dx * ta;
      from.array[k + 1] = p[1] + dy * ta;
      to.array[k] = p[0] + dx * tb;
      to.array[k + 1] = p[1] + dy * tb;
      const span = s1 - s0;
      alpha.array[k] = a0 + ((sa - s0) / span) * (a1 - a0);
      alpha.array[k + 1] = a0 + ((sb - s0) / span) * (a1 - a0);
      taper.array[k] = pointed && sa === s0 ? 1 : 0;
      taper.array[k + 1] = pointed && sb === s1 ? 1 : 0;
      count++;
    }
  };

  // A lit segment drawn in place, as a one-leg route between its inset ends.
  const segmentRoute = (segment: Segment, inset: number): Route => {
    const [x0, y0] = segment['from'];
    const [x1, y1] = segment['to'];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const total = 1 - 2 * inset;
    return {
      'points': [
        [x0 + dx * inset, y0 + dy * inset],
        [x1 - dx * inset, y1 - dy * inset],
      ],
      'lengths': [0, total],
      'total': total,
    };
  };

  const update = (now: number, layout: Layout, bound: Vec2, params: Params) => {
    const travel = params['travel'];
    const fade = params['fade'];
    const ease = params['ease'];
    const inset = params['inset'];
    const bodyLength = Math.max(0, 1 - 2 * inset);
    halfWidth = params['lineWidth'] * 0.5;
    count = 0;

    // How much is left of a digit that is replaced at second `arrival`. It starts fading fadeLead seconds
    // BEFORE the new value lands, so the old one is out of the way by the time the new one arrives.
    // Squared, not linear: it drops quickly at first and then leaves a soft tail, so a short fade does
    // not read as switching off. A linear fade short enough to feel quick ends on a visible cut.
    const fadeLead = params['fadeLead'];
    const lifeFor = (arrival: number) => {
      const remaining = Math.min(1, Math.max(0, 1 - (now - (arrival - fadeLead)) / fade));
      return remaining * remaining;
    };

    // The second on display: every segment lit now has already landed. A digit about to be replaced at
    // the next second is already on its way out.
    const shown = Math.floor(now);
    const leaving = changedDigits(shown + 1);
    const lifeNext = lifeFor(shown + 1);
    for (const segment of litSegments(new Date(shown * 1000), layout)) {
      const life = leaving[segment['digit']] ? lifeNext : 1;
      const route = segmentRoute(segment, inset);
      emit(route, 0, route['total'], life, life, true);
    }
    // With fadeLead shorter than fade, the old value is still fading after the new one has landed.
    const lifeNow = lifeFor(shown);
    if (lifeNow > 0) {
      const changed = changedDigits(shown);
      for (const segment of litSegments(new Date((shown - 1) * 1000), layout)) {
        if (!changed[segment['digit']]) continue;
        const route = segmentRoute(segment, inset);
        emit(route, 0, route['total'], lifeNow, lifeNow, true);
      }
    }

    // Lines in flight: the whole new value of each digit that changes at their second. A digit that does
    // not change sends nothing, so most seconds only the last digit moves.
    const center: Vec2 = [(layout['min'][0] + layout['max'][0]) / 2, (layout['min'][1] + layout['max'][1]) / 2];
    const first = shown + 1;
    const last = Math.floor(now + travel);
    for (const key of batches.keys()) if (key < first) batches.delete(key);
    for (let arrival = first; arrival <= last; arrival++) {
      if (batches.has(arrival)) continue;
      const changed = changedDigits(arrival);
      const routes = litSegments(new Date(arrival * 1000), layout)
        .map((segment, i) => ({ segment, i }))
        .filter(({ segment }) => changed[segment['digit']])
        .map(({ segment, i }) =>
          buildRoute(segment, center, bound, params, createRandom(arrival * 97 + i * 7919 + params['seed'])),
        );
      batches.set(arrival, { 'arrival': arrival, 'routes': routes });
    }

    for (const batch of batches.values()) {
      const u = (now - (batch['arrival'] - travel)) / travel;
      if (u < 0 || u >= 1) continue;
      // Ease-out: fast in from off screen, settling onto the segment. The trail is the distance covered in
      // the last trailTime seconds, so it shrinks to nothing as the line slows and is gone on arrival.
      const progress = 1 - Math.pow(1 - u, ease);
      const speed = (ease * Math.pow(1 - u, ease - 1)) / travel; // fraction of the route per second
      for (const route of batch['routes']) {
        const headAt = route['total'] * progress;
        const bodyAt = Math.max(0, headAt - bodyLength);
        const trail = Math.min(params['trailTime'] * speed * route['total'], params['trailMax']);
        if (trail > 1e-4) {
          const trailAt = Math.max(0, bodyAt - trail);
          emit(route, trailAt, bodyAt, (trailAt - (bodyAt - trail)) / trail, 1, false);
        }
        emit(route, bodyAt, headAt, 1, 1, true);
      }
    }

    geometry.instanceCount = count;
    for (const attribute of attributes) {
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, count * 2);
      attribute.needsUpdate = true;
    }
    material.uniforms['uWidth']!.value = params['lineWidth'];
    material.uniforms['uBrightness']!.value = params['brightness'];
    (material.uniforms['uColor']!.value as THREE.Color).setHex(params['lineColor']);
  };

  return { 'mesh': mesh, 'update': update };
};
