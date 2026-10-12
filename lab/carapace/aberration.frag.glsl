// Chromatic aberration that grows toward the frame edges, the way a real lens does.
//
// The amount is scaled by the squared distance from the centre, so the middle of the frame stays clean and
// the corners smear. A constant offset instead reads as a broken video signal, not as a lens.
precision highp float;

uniform sampler2D tDiffuse;
uniform float uAmount;

varying vec2 vUv;

void main() {
  vec2 centered = vUv - 0.5;
  // Pull each channel toward / away from the centre by a different amount. Green stays put so the image
  // does not appear to shift as a whole.
  // uAmount is the UV offset at the corners, where dot(centered, centered) is ~0.5. Keep the knob small:
  // 0.1 already shifts a tenth of the frame, which reads as a broken signal rather than as a lens.
  vec2 offset = centered * dot(centered, centered) * uAmount * 2.0;

  float r = texture2D(tDiffuse, vUv - offset).r;
  float g = texture2D(tDiffuse, vUv).g;
  float b = texture2D(tDiffuse, vUv + offset).b;

  gl_FragColor = vec4(r, g, b, 1.0);
}
