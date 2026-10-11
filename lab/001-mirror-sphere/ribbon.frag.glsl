precision highp float;

uniform vec3 uColorHead;
uniform vec3 uColorTail;
uniform float uHueSpread;
uniform float uIntensity;

in float vS;
in float vSeed;   // 0..1, constant per ribbon

out vec4 outColor;

const float TAU = 6.283185307179586;

// Rotate a colour around the grey axis (Rodrigues). Cheaper and less lossy than converting to HSV
// and back, and it leaves greys alone, which is what keeps the near-white heads from tinting.
vec3 hueShift(vec3 c, float angle) {
  const vec3 k = vec3(0.57735026919); // normalize(vec3(1.0))
  float ca = cos(angle);
  return c * ca + cross(k, c) * sin(angle) + k * dot(k, c) * (1.0 - ca);
}

void main() {
  // Hue and brightness have to ramp on different curves. Driving both from s puts the saturated
  // colour where the ribbon is already dark, so the hue never actually shows — the first version of
  // this read as pale mint fading to nothing. The hue lands early instead, and the body carries it.
  vec3 c = mix(uColorHead, uColorTail, smoothstep(0.0, 0.3, vS));

  // Each ribbon sits at a slightly different hue, so the group reads as a palette rather than as one
  // colour repeated. Keyed off the ribbon's phase offset, so it is stable across runs.
  c = hueShift(c, (vSeed - 0.5) * uHueSpread * TAU);

  // The falloff is what makes it read as motion rather than as a static loop of tape.
  outColor = vec4(c * pow(1.0 - vS, 1.2) * uIntensity, 1.0);
}
