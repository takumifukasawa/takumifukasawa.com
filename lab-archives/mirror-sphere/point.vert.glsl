// The emitter itself: a small sphere riding the same path the ribbons trail from.
// Shares emitterAt(), so the dot and the trails can never disagree about where the point is.

in vec3 position;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform float uPointSize;

out vec3 vLocal;

void main() {
  vLocal = position;
  // k = uPull with no ageing: the dot is the newest point on the path, so it is pulled in full.
  vec3 centre = emitterAt(uPhase, uPull);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(centre + position * uPointSize, 1.0);
}
