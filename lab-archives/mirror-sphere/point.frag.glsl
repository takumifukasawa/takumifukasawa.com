precision highp float;

uniform vec3 uColorHead;
uniform float uIntensity;

in vec3 vLocal;
out vec4 outColor;

void main() {
  // Hot in the middle, falling off toward the silhouette, so the bloom has a core to bite into and
  // the dot does not read as a flat disc.
  float edge = 1.0 - clamp(length(vLocal), 0.0, 1.0);
  outColor = vec4(uColorHead * uIntensity * (0.6 + 2.2 * edge * edge), 1.0);
}
