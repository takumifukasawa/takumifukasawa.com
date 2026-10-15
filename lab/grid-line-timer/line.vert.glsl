// One straight piece of a line: a quad from aFrom to aTo on the grid plane (z = 0), uWidth cells wide.
// position.x runs 0..1 along the piece and position.y -1..1 across it (lines.ts).
attribute vec2 aFrom;
attribute vec2 aTo;
attribute vec2 aAlpha;
attribute vec2 aTaper;

uniform float uWidth;

varying float vAlpha;
varying vec2 vEnds; // distance to the from end and to the to end, cells
varying float vAcross; // distance from the centre line, cells
varying vec2 vTaper;

void main() {
  vec2 d = aTo - aFrom;
  float len = length(d);
  vec2 dir = d / max(len, 1e-6);
  vec2 side = vec2(-dir.y, dir.x);
  vec2 p = aFrom + d * position.x + side * position.y * uWidth * 0.5;
  vAlpha = mix(aAlpha.x, aAlpha.y, position.x);
  vEnds = vec2(position.x, 1.0 - position.x) * len;
  vAcross = position.y * uWidth * 0.5;
  vTaper = aTaper;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
}
