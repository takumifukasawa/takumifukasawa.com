// Ribbons trailing behind the emitter.
//
// Each ribbon is a slice of where the emitter has been: its head sits at emitterAt(phase - offset)
// and its body walks further back in time along s. So the whole swarm traces one path at different
// delays, and the only thing that separates one ribbon from another is when it was shed and how far
// it has drifted since.
//
// No history buffer, no simulation: the position at any (s, phase) is computed from the phase alone.
// That is what keeps the recording loop exact — at phase 0 and phase 1 every term returns to the
// same value. A trail built by accumulating past positions could not do that.
//
// The pointer is the one piece of state (uPull / uTarget, used inside emitterAt). It is weighted by
// s, so the head follows and the tail lags. With no interaction uPull stays 0 and the loop is intact.

in float aS;      // 0 at the head, 1 at the tail
in float aSide;   // -1 / +1, the two edges of the strip
in vec3 aDir;     // the direction this ribbon drifts away from the path as it ages
in vec4 aParams;  // x: time offset, y: tail length in phase, z: drift amount, w: pull scale

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform float uWidth;
uniform float uTwist;
uniform float uDepth;
uniform float uSpread;

out float vS;
out float vSeed;

const float TAU = 6.283185307179586;
// Step for the finite-difference tangent. Not tied to the segment count: it only has to be small
// enough to approximate the derivative and large enough to stay out of float noise.
const float DS = 0.004;

vec3 ribbonCenter(float s) {
  // How far back in time this point is. The head carries the ribbon's own offset; s walks back from
  // there, so the body is literally the emitter's past.
  float age = aParams.x + s * aParams.y;

  // Older parts are pulled less, which is what makes the body look like it is catching up rather
  // than being dragged rigidly.
  float k = uPull * aParams.w * pow(1.0 - s, uDepth);

  vec3 p = emitterAt(uPhase - age, k);

  // Spreading with age is what separates the ribbons. Without it they all lie exactly on the same
  // path and the swarm reads as one long trail instead of many.
  p += aDir * (uSpread * aParams.z * s);

  float len = max(length(p), 1e-4);
  return p * max(1.0, uMinRadius / len);
}

void main() {
  vec3 p = ribbonCenter(aS);

  // Central difference rather than an analytic derivative: the path is bent by the pull and by the
  // spread, so the closed form of the underlying curve is not the tangent of what is actually drawn.
  vec3 tangent = normalize(ribbonCenter(min(aS + DS, 1.0)) - ribbonCenter(max(aS - DS, 0.0)));

  // A frame needs a reference that is not parallel to the tangent. aDir is random per ribbon and
  // almost never is; the fallback covers the case where it is.
  vec3 side = cross(tangent, aDir);
  if (dot(side, side) < 1e-6) side = cross(tangent, vec3(0.0, 1.0, 0.0));
  vec3 n1 = normalize(side);
  vec3 n2 = cross(tangent, n1);

  // Rotating the width direction along the ribbon is what reads as "ribbon" rather than "tube".
  float twist = TAU * (aS * uTwist + uPhase);
  vec3 width = n1 * cos(twist) + n2 * sin(twist);

  // Tapers to nothing at the tail, so the ribbon ends without a cut edge.
  float w = uWidth * (1.0 - aS) * (1.0 - aS);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(p + width * aSide * w, 1.0);
  vS = aS;
  vSeed = aParams.x; // the time offset doubles as a stable per-ribbon seed
}
