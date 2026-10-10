// Mirror sphere — vertex stage.
// RawShaderMaterial: nothing is injected. Every attribute and uniform used here is declared here.
// three.js still *populates* these built-ins; it just does not write the code for you.

in vec3 position;
in vec3 normal;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 modelMatrix;   // object -> world
uniform mat3 normalMatrix;  // built from modelViewMatrix, so it maps normals into VIEW space

out vec3 vWorldPosition;
out vec3 vWorldNormal;

void main() {
  // Clip space. Provided: this chain is fixed and there is nothing to decide here.
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

  // TODO(you): both of these must be in WORLD space, because the cube map is a world-space lookup.
  //
  //  - vWorldPosition: this vertex, in the world.
  //  - vWorldNormal:   the surface direction, in the world.
  //      `normalMatrix` above is the inverse-transpose of modelViewMatrix's 3x3, so it gives a
  //      VIEW-space normal. Using it here is the single most common bug in this sketch: the
  //      reflection will then swim around as the camera moves, because it is anchored to the camera
  //      instead of to the world. Work out what to use instead, and why the transpose/inverse
  //      matters at all (hint: it only differs from the plain 3x3 under non-uniform scale).
  //
  // Placeholder: correct only while the model matrix has no rotation or scale.
  vWorldPosition = position;
  vWorldNormal = normalize(normal);
}
