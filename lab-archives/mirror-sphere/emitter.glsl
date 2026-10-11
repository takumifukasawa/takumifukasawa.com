// The emitter: one point that keeps moving, shared by the ribbons and by the dot that marks it.
// Prepended to both shaders, so the two can never drift apart.
//
// The path is a sum of integer harmonics. That is what makes it close: every term returns to its
// starting value after exactly one turn of the phase, so the whole loop is seamless without any
// blending at the seam. Non-integer frequencies would wander forever and the recording would cut.

uniform float uPhase;
uniform float uEmitterRadius;
uniform float uDrift;
uniform float uPull;
uniform vec3 uTarget;
uniform float uMinRadius;

const float TAU_E = 6.283185307179586;

vec3 wanderDir(float p) {
  float a = TAU_E * p;
  vec3 w = vec3(
    sin(a) + 0.55 * sin(a * 2.0 + 1.3),
    sin(a * 2.0 + 1.7) + 0.45 * sin(a * 3.0 + 0.4),
    cos(a + 2.2) + 0.50 * cos(a * 3.0 + 2.8)
  );
  float l = length(w);
  // The harmonics can cancel. Any direction will do there; picking a constant keeps it continuous.
  return l > 1e-3 ? w / l : vec3(0.0, 1.0, 0.0);
}

// A second, faster path used only as a small offset, so that while the pointer holds the emitter
// still hovers around the target instead of sitting on it.
vec3 driftOffset(float p) {
  float a = TAU_E * p;
  return vec3(sin(a * 5.0 + 0.6), cos(a * 7.0 + 2.1), sin(a * 6.0 + 4.2));
}

// k: 0 = free wander, 1 = fully drawn to the pointer target.
vec3 emitterAt(float p, float k) {
  vec3 dirWander = wanderDir(p);

  // uTarget starts at the origin, and normalize(vec3(0)) is NaN — which mix() does not rescue,
  // because 0 * NaN is still NaN. Guard the length before dividing.
  float tLen = length(uTarget);
  vec3 dirTarget = tLen > 1e-4 ? uTarget / tLen : dirWander;
  float targetRadius = tLen > 1e-4 ? tLen : uEmitterRadius;

  // Blend on a shell rather than along a straight line: a chord between two points outside the
  // sphere still cuts through it.
  vec3 m = mix(dirWander, dirTarget, k);
  float ml = length(m);
  vec3 dir = ml > 1e-3 ? m / ml : dirWander;

  vec3 pos = dir * mix(uEmitterRadius, targetRadius, k) + driftOffset(p) * uDrift * k;

  float len = max(length(pos), 1e-4);
  return pos * max(1.0, uMinRadius / len);
}
