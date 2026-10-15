// Flat and HDR: uBrightness above the bloom threshold is what makes a line read as light. Additive, so
// lines crossing each other add up and bloom brighter where they meet.
//
// The 7-segment bar: an elongated hexagon. A pointed end keeps only the pixels whose distance from the centre
// line is less than their distance from the end, which cuts both corners at 45 degrees into a tip.
uniform vec3 uColor;
uniform float uBrightness;

varying float vAlpha;
varying vec2 vEnds;
varying float vAcross;
varying vec2 vTaper;

void main() {
  float across = abs(vAcross);
  // Signed distance to each 45-degree cut (positive = inside). A square end never cuts.
  vec2 cut = mix(vec2(1e3), vEnds - across, vTaper);
  float inside = min(cut.x, cut.y);
  // Antialiased edge: a discard would be a hard step that MSAA cannot smooth.
  float edge = clamp(inside / max(fwidth(inside), 1e-5) + 0.5, 0.0, 1.0);
  gl_FragColor = vec4(uColor * uBrightness * vAlpha * edge, 1.0);
}
