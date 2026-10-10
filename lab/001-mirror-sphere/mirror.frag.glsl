// Mirror sphere — fragment stage. A perfect mirror: no roughness, no Fresnel, no BRDF.
// Those arrive in 002 / 003 / 004 one at a time (docs/plans).

precision highp float;

uniform samplerCube envMap;
uniform vec3 cameraPosition;  // populated by three.js

in vec3 vWorldPosition;
in vec3 vWorldNormal;

out vec4 outColor;

void main() {
  vec3 n = normalize(vWorldNormal);

  // TODO(you): a perfect mirror is three lines.
  //
  //  1. The view direction. Decide which way it points — from the eye to the surface, or the other
  //     way. GLSL's reflect(I, N) expects I to point TOWARD the surface. Getting this backwards
  //     gives a reflection that looks plausible at first and is inside-out.
  //  2. Reflect it about n.
  //  3. Sample envMap with that direction. A samplerCube is indexed by a direction, not a uv —
  //     the magnitude is ignored, so there is no need to normalize for the lookup itself.
  //
  // Once it works, the thing to notice: the reflection does not depend on where the sphere is,
  // only on the normal and the eye direction. That is exactly why a cube map is cheap, and also
  // why it is wrong for anything but a small object in a distant environment.
  //
  // Placeholder: a grayscale ramp so the sphere is visible before the reflection exists.
  float g = n.y * 0.5 + 0.5;
  outColor = vec4(vec3(g), 1.0);
}
