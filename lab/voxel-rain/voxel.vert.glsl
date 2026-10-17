varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vLocal;
varying float vDepth;

void main() {
  // The instance only scales and translates an axis-aligned box, so the object normal is the world normal.
  vNormal = normal;
  vColor = instanceColor;
  // Where on the unit box (-0.5 to 0.5 on each axis) this vertex is, for finding the edges.
  vLocal = position;
  vec4 view = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  // Distance in front of the camera, for the fog.
  vDepth = -view.z;
  gl_Position = projectionMatrix * view;
}
