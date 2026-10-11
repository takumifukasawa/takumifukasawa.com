// Ribbons orbiting the sphere.
//
// The resting shape is a pure function of (phase, s): no trail history, no simulation. s runs 0 at
// the head to 1 at the tail. That is what makes the recording loop exactly — at phase 0 and phase 1
// every angle here differs by exactly one turn, so the geometry is identical. A trail built by
// accumulating past positions could not do that.
//
// The pointer adds the only state in the sketch: uPull (0 = resting orbit, 1 = fully pulled) and
// uTarget. It weights by s, so the head goes and the body follows. With no interaction uPull stays
// 0 and the exact loop is intact — which is why recording a clean clip only requires not clicking.

in float aS;      // 0 at the head, 1 at the tail
in float aSide;   // -1 / +1, the two edges of the strip
in vec3 aU;       // orbit plane basis
in vec3 aV;
in vec4 aParams;  // x: orbit radius, y: phase offset, z: tail length in turns, w: pull scale

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform float uPhase;
uniform float uPull;
uniform vec3 uTarget;
uniform float uWidth;
uniform float uTwist;
uniform float uDepth;
uniform float uMinRadius;  // never let the ribbon get closer to the centre than this

out float vS;
out float vSeed;

const float TAU = 6.283185307179586;
// Step for the finite-difference tangent. Not tied to the segment count: it only has to be small
// enough to approximate the derivative and large enough to stay out of float noise.
const float DS = 0.004;

vec3 ribbonCenter(float s) {
  float a = TAU * (uPhase + aParams.y - s * aParams.z);
  vec3 orbit = aParams.x * (cos(a) * aU + sin(a) * aV);

  // Weighted by s: 1 at the head, 0 at the tail. The ribbon is not dragged rigidly — it is bent,
  // which is what makes the body look like it is catching up rather than being teleported.
  float k = uPull * aParams.w * pow(1.0 - s, uDepth);

  // Blend on a shell rather than along a straight line. mix(orbit, uTarget, k) is a chord, and a
  // chord between two points outside a sphere still cuts through it — which is exactly how the
  // ribbons ended up inside the mirror while dragging. Interpolating the direction and the radius
  // separately keeps the path going *around* the centre instead.
  vec3 dirOrbit = normalize(orbit);

  // uTarget starts at the origin, and normalize(vec3(0)) is NaN. mix() does not save you: 0 * NaN is
  // still NaN, so even with k == 0 the NaN propagates and the whole ribbon disappears. Guard the
  // length before normalizing, always.
  float tLen = length(uTarget);
  vec3 dirTarget = tLen > 1e-4 ? uTarget / tLen : dirOrbit;
  float targetRadius = tLen > 1e-4 ? tLen : aParams.x;

  vec3 m = mix(dirOrbit, dirTarget, k);
  float ml = length(m);
  // Nearly antipodal: the midpoint collapses to zero and the direction is undefined. Any choice is
  // arbitrary there, so keep the one it came from.
  vec3 dir = ml > 1e-3 ? m / ml : dirOrbit;
  float blendedRadius = mix(aParams.x, targetRadius, k);

  vec3 p = dir * blendedRadius;

  // Safety net for whatever the blend above does not cover (uTarget inside the shell, say).
  float len = max(length(p), 1e-4);
  return p * max(1.0, uMinRadius / len);
}

void main() {
  vec3 p = ribbonCenter(aS);

  // Central difference instead of the analytic derivative: once the curve is deformed by the pull,
  // the closed-form tangent of the circle is no longer the tangent of the actual curve.
  vec3 tangent = normalize(ribbonCenter(min(aS + DS, 1.0)) - ribbonCenter(max(aS - DS, 0.0)));

  // A frame needs a reference direction that is not parallel to the tangent. The orbit plane normal
  // is constant per ribbon and nearly always works; the fallback covers the case where the pull has
  // bent the curve until it points along that normal.
  vec3 ref = normalize(cross(aU, aV));
  vec3 side = cross(tangent, ref);
  if (dot(side, side) < 1e-6) side = cross(tangent, aU);
  vec3 n1 = normalize(side);
  vec3 n2 = cross(tangent, n1);

  // Rotating the width direction along the ribbon is what reads as "ribbon" rather than "tube".
  // The uPhase term is one whole turn per loop, so it survives the loop boundary intact.
  float twist = TAU * (aS * uTwist + uPhase);
  vec3 width = n1 * cos(twist) + n2 * sin(twist);

  // Tapers to nothing at the tail, so the ribbon ends without a cut edge.
  float w = uWidth * (1.0 - aS) * (1.0 - aS);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(p + width * aSide * w, 1.0);
  vS = aS;
  vSeed = aParams.y; // the ribbon's phase offset doubles as a stable per-ribbon seed
}
