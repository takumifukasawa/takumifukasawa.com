precision highp float;

in float vS;
out vec4 outColor;

void main() {
  // Monochrome, fading toward the tail (AGENTS.md: no colour, one subject, no bloom).
  // The falloff is what makes it read as motion rather than as a static loop of tape.
  outColor = vec4(vec3(pow(1.0 - vS, 1.6)), 1.0);
}
