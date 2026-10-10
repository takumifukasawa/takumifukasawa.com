// Mirror sphere — vertex stage.
// RawShaderMaterial: nothing is injected. Every attribute and uniform used here is declared here.
// three.js still *populates* these built-ins; it just does not write the code for you.

in vec3 position;
in vec3 normal;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 modelMatrix;   // object -> world
uniform mat3 normalMatrix;  // built from modelViewMatrix, so it maps normals into VIEW space — not used here

out vec3 vWorldPosition;
out vec3 vWorldNormal;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);

  vWorldPosition = worldPosition.xyz;

  // World space, because the cube map is a world-space lookup.
  //
  // Not `normalMatrix`: three builds that from modelViewMatrix, so it lands in view space. Using it
  // here is the classic bug in this sketch — the reflection stays glued to the camera and swims as
  // the camera moves, instead of staying anchored to the world.
  //
  // mat3(modelMatrix) is correct as long as the scale is uniform. Under non-uniform scale a normal
  // is not a direction but a plane, so it transforms by the inverse-transpose; three does not hand
  // that out for the world matrix, so it would have to be computed and passed in. This sphere has
  // no scale at all, so the simple form is exact here.
  vWorldNormal = normalize(mat3(modelMatrix) * normal);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
