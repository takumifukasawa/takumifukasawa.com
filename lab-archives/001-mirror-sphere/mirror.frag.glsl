// Mirror sphere — fragment stage. A perfect mirror: no roughness, no Fresnel, no BRDF.
// Those arrive in 002 / 003 / 004 one at a time.

precision highp float;

uniform samplerCube envMap;
uniform vec3 cameraPosition;  // populated by three.js
uniform float uShowFaces;     // debug: tint by which cube face the reflection lands on

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
  vec3 color = texture(envMap, reflected).rgb;

  // Debug: which of the 6 faces is this sample coming from? The face is decided by the largest
  // component of the direction, which is exactly how a cube map is indexed. Looking at the sphere
  // head on, the centre samples +Z and the ring around it walks through the four side faces, so a
  // real seam shows up as a hard edge exactly where these tints meet.
  if (uShowFaces > 0.5) {
    vec3 a = abs(reflected);
    vec3 tint =
      (a.x >= a.y && a.x >= a.z) ? (reflected.x > 0.0 ? vec3(1.0, 0.3, 0.3) : vec3(0.5, 0.15, 0.15)) :
      (a.y >= a.z)               ? (reflected.y > 0.0 ? vec3(0.3, 1.0, 0.3) : vec3(0.15, 0.5, 0.15)) :
                                   (reflected.z > 0.0 ? vec3(0.3, 0.3, 1.0) : vec3(0.15, 0.15, 0.5));
    color = mix(tint * 0.35, color + tint * 0.25, 0.6);
  }

  outColor = vec4(color, 1.0);
}
