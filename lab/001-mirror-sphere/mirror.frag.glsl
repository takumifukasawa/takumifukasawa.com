// Mirror sphere — fragment stage. A perfect mirror: no roughness, no Fresnel, no BRDF.
// Those arrive in 002 / 003 / 004 one at a time.

precision highp float;

uniform samplerCube envMap;
uniform vec3 cameraPosition;  // populated by three.js

in vec3 vWorldPosition;
in vec3 vWorldNormal;

out vec4 outColor;

void main() {
  vec3 n = normalize(vWorldNormal);

  // Points *toward* the surface, which is what reflect(I, N) expects. The other way round still
  // produces a picture — it just comes out inside-out, which is why this one is easy to get wrong
  // and hard to notice.
  vec3 incident = normalize(vWorldPosition - cameraPosition);

  vec3 reflected = reflect(incident, n);

  // A samplerCube is indexed by a direction, not a uv: the magnitude is ignored, so the lookup
  // itself does not need the normalize above. It is there because `incident` is also used as a
  // direction by reflect().
  //
  // Worth noticing: nothing here depends on where the sphere *is*, only on the normal and the eye
  // direction. That is exactly why a cube map is cheap, and also why it is only correct for a small
  // object inside a distant environment — move the sphere and the reflection does not parallax.
  outColor = vec4(texture(envMap, reflected).rgb, 1.0);
}
