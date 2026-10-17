uniform vec3 uLight;
uniform float uShade;
uniform vec3 uEdgeColor;
uniform float uEdgeGain;
uniform float uEdgeWidth;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;

varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vLocal;
varying float vDepth;

void main() {
  // The voxels are light, not lit: the shading only tells the faces apart, so a lit cell reads as a cube.
  float face = 1.0 - uShade + uShade * (0.5 + 0.5 * dot(normalize(vNormal), uLight));
  vec3 color = vColor * face;

  // Distance to the box's sides along each axis. On a face one of them is 0 (the face's own axis); a point is
  // on an edge when a second one is small too, so the edge distance is the middle of the three.
  vec3 d = 0.5 - abs(vLocal);
  float edge = d.x + d.y + d.z - min(d.x, min(d.y, d.z)) - max(d.x, max(d.y, d.z));
  // Width in cells, softened over about a pixel so far voxels do not crawl.
  float aa = fwidth(edge);
  float onEdge = 1.0 - smoothstep(uEdgeWidth - aa, uEdgeWidth + aa, edge);
  // As bright as the voxel itself, so an edge fades with its voxel.
  vec3 edgeColor = uEdgeColor * uEdgeGain * max(vColor.r, max(vColor.g, vColor.b));
  // Into the background with distance, so the floor has no far edge to see.
  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  gl_FragColor = vec4(mix(mix(color, edgeColor, onEdge), uFogColor, fog), 1.0);
}
