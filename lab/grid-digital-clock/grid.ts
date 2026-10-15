// The grid the lines ride on. Faint, and fading out with distance from the clock so it has no visible edge.
//
// Two layers, both additive and both under the lines:
//   - the lines themselves, as GL lines (1 px whatever the distance, which is what a grid should be)
//   - a plane covering the same area, whose fragment shader draws a small X on every grid point and
//     sends a ring of light out across the cells from each digit that changes. Per-pixel, so neither costs anything per cell on the CPU.
import * as THREE from 'three';
import { changedDigits, digitCenter, digitsAt, segmentCount, type Layout } from './clock.ts';
import type { Params } from './params.ts';

// Must match MAX_RIPPLES in the shader. 16 covers a few seconds of the seconds digit plus a carry.
const MAX_RIPPLES = 16;

export type Grid = {
  'object': THREE.Group;
  // now: wall-clock epoch seconds, the same clock the lines land on.
  'update': (now: number, layout: Layout, center: [number, number], params: Params) => void;
  // A ring from a point on the grid plane, starting now -- a click or tap. Full reach, like an 8.
  'tap': (x: number, y: number, now: number) => void;
};

const lineVertex = `
varying vec2 vPos;
void main() {
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const lineFragment = `
uniform vec3 uColor;
uniform vec2 uCenter;
uniform vec2 uFade;
varying vec2 vPos;
void main() {
  float a = 1.0 - smoothstep(uFade.x, uFade.y, length(vPos - uCenter));
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

const planeVertex = `
varying vec2 vPos;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPos = world.xy;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const planeFragment = `
uniform vec3 uMarkColor;
uniform float uMarkSize;
uniform float uMarkWidth;
uniform vec3 uCellColor;
#define MAX_RIPPLES 16
uniform vec4 uRipples[MAX_RIPPLES]; // centre xy, age in seconds (negative = empty slot), reach (0..1)
uniform float uRippleRadius;
uniform float uRippleEase;
uniform float uRippleWidth;
uniform float uRippleLife;
uniform vec2 uCenter;
uniform vec2 uFade;
varying vec2 vPos;

// Signed distance to an X: two bars crossing at 45 degrees, each arm long from the centre and width
// across. The arms point into the diagonal gaps between the pointed ends of the segments meeting at a grid
// point, so at the corner of a digit the mark fills the space the segments leave.
float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float sdCross(vec2 p, float arm, float width) {
  vec2 q = vec2(p.x + p.y, p.y - p.x) * 0.70710678;
  vec2 size = vec2(arm, width * 0.5);
  return min(sdBox(q, size), sdBox(q.yx, size));
}

void main() {
  float fade = 1.0 - smoothstep(uFade.x, uFade.y, length(vPos - uCenter));

  // A mark on the nearest grid point.
  vec2 local = vPos - floor(vPos + 0.5);
  float d = sdCross(local, uMarkSize, uMarkWidth);
  float mark = uMarkSize > 0.0 ? clamp(0.5 - d / max(fwidth(d), 1e-5), 0.0, 1.0) : 0.0;

  // Rings going out from the digits that changed, a cell at a time: each cell is tested at its centre, so
  // a whole cell lights together and the ring advances in steps. Overlapping rings add up.
  vec2 cell = floor(vPos) + 0.5;
  float pulse = 0.0;
  for (int i = 0; i < MAX_RIPPLES; i++) {
    vec4 r = uRipples[i];
    if (r.z < 0.0) continue;
    // Ease-out, like the lines: the ring leaves fast, carrying the lines' arrival, and slows to a stop at
    // uRippleRadius as it fades.
    float a = clamp(r.z / uRippleLife, 0.0, 1.0);
    float radius = uRippleRadius * r.w * (1.0 - pow(1.0 - a, uRippleEase));
    float ring = 1.0 - abs(length(cell - r.xy) - radius) / max(uRippleWidth, 1e-3);
    float decay = 1.0 - a;
    pulse += smoothstep(0.0, 1.0, clamp(ring, 0.0, 1.0)) * decay * decay;
  }
  pulse = min(pulse, 1.5);

  gl_FragColor = vec4((uMarkColor * mark + uCellColor * pulse) * fade, 1.0);
}`;

export const createGrid = (): Grid => {
  const lineMaterial = new THREE.ShaderMaterial({
    uniforms: {
      'uColor': { value: new THREE.Color() },
      'uCenter': { value: new THREE.Vector2() },
      'uFade': { value: new THREE.Vector2() },
    },
    vertexShader: lineVertex,
    fragmentShader: lineFragment,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const lines = new THREE.LineSegments(new THREE.BufferGeometry(), lineMaterial);
  lines.frustumCulled = false;

  const ripples = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -1, 1));
  const planeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      'uMarkColor': { value: new THREE.Color() },
      'uMarkSize': { value: 0.05 },
      'uMarkWidth': { value: 0.02 },
      'uCellColor': { value: new THREE.Color() },
      'uRipples': { value: ripples },
      'uRippleRadius': { value: 1 },
      'uRippleEase': { value: 1 },
      'uRippleWidth': { value: 1 },
      'uRippleLife': { value: 1 },
      // Shared with the lines: the same objects, so one write updates both.
      'uCenter': lineMaterial.uniforms['uCenter']!,
      'uFade': lineMaterial.uniforms['uFade']!,
    },
    vertexShader: planeVertex,
    fragmentShader: planeFragment,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), planeMaterial);
  plane.frustumCulled = false;

  const object = new THREE.Group();
  object.add(plane, lines);
  let built = -1;
  // Taps still inside rippleLife: x, y, and the wall-clock time they started.
  let taps: [number, number, number][] = [];

  return {
    'object': object,
    'update': (now, layout, center, params) => {
      // Integer lines only: the clock and every route sit on the integer lattice.
      const n = Math.max(1, Math.round(params['gridExtent']));
      if (n !== built) {
        built = n;
        const positions: number[] = [];
        for (let i = -n; i <= n; i++) {
          positions.push(i, -n, 0, i, n, 0, -n, i, 0, n, i, 0);
        }
        lines.geometry.dispose();
        lines.geometry = new THREE.BufferGeometry();
        lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        plane.scale.set(n * 2, n * 2, 1);
      }
      (lineMaterial.uniforms['uColor']!.value as THREE.Color).setHex(params['gridColor']);
      (lineMaterial.uniforms['uCenter']!.value as THREE.Vector2).set(center[0], center[1]);
      (lineMaterial.uniforms['uFade']!.value as THREE.Vector2).set(params['gridFadeNear'], params['gridFadeFar']);
      const u = planeMaterial.uniforms;
      (u['uMarkColor']!.value as THREE.Color).setHex(params['markColor']);
      u['uMarkSize']!.value = params['markSize'];
      u['uMarkWidth']!.value = params['markWidth'];
      (u['uCellColor']!.value as THREE.Color).setHex(params['cellColor']);
      u['uRippleRadius']!.value = params['rippleRadius'];
      u['uRippleEase']!.value = params['rippleEase'];
      u['uRippleWidth']!.value = params['rippleWidth'];
      u['uRippleLife']!.value = params['rippleLife'];
      // One ring per digit that changes, for every second whose ring is still inside rippleLife, newest
      // first. A ring starts rippleLead seconds BEFORE its second, while the lines are still gathering.
      let count = 0;
      // Taps first: a ring the viewer asked for should never be the one dropped when the slots run out.
      taps = taps.filter(([, , t]) => now - t < params['rippleLife']);
      for (let i = taps.length - 1; i >= 0 && count < MAX_RIPPLES; i--) {
        const [x, y, t] = taps[i]!;
        ripples[count++]!.set(x, y, now - t, 1);
      }
      const lead = params['rippleLead'];
      for (let t = Math.floor(now + lead); t - lead > now - params['rippleLife'] && count < MAX_RIPPLES; t--) {
        const digits = digitsAt(new Date(t * 1000));
        changedDigits(t).forEach((changed, i) => {
          if (!changed || count >= MAX_RIPPLES) return;
          const [x, y] = digitCenter(layout, i);
          // The more lines gathered into the digit, the further (and so faster) its ring goes: an 8 is
          // 7 lines, a 1 is 2. rippleEnergy 0 makes every ring the same.
          const energy = params['rippleEnergy'];
          const reach = 1 - energy + (energy * segmentCount(digits[i]!)) / 7;
          ripples[count++]!.set(x, y, now - (t - lead), reach);
        });
      }
      for (let i = count; i < MAX_RIPPLES; i++) ripples[i]!.z = -1;
    },
    'tap': (x, y, now) => {
      taps.push([x, y, now]);
    },
  };
};
