// Bloom, written out rather than taken from three's EffectComposer / UnrealBloomPass.
// Not because the ready-made one is off limits — it is allowed — but because the chain below is the
// part of this sketch worth understanding, and it is short enough to read in one sitting.
//
// The shape of it:
//   scene -> half-float target        so colours can exceed 1.0 and the bright pass has something to find
//   bright pass -> level 0            everything above the threshold, at half resolution
//   blur + downsample -> level 1..3   each level is half the previous one, blurred as it shrinks
//   composite                         scene + the sum of the levels
//
// Downsampling is what makes this cheap: a wide glow comes from blurring a small image, not from a
// large kernel. Each level costs a quarter of the one before, so the whole chain is about a third of
// one full-resolution blur.
//
// Separable blur: a 2D gaussian is the product of two 1D gaussians, so a horizontal pass followed by
// a vertical one gives the same result as a square kernel for 2n taps instead of n².

import * as THREE from 'three';

const LEVELS = 4;

const QUAD_VERT = `
  in vec3 position;
  out vec2 vUv;
  void main() {
    // A single oversized triangle instead of two triangles: no seam down the diagonal, and every
    // pixel is covered by one primitive.
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BRIGHT_FRAG = `
  precision highp float;
  uniform sampler2D tSrc;
  uniform float uThreshold;
  uniform float uSoft;
  in vec2 vUv;
  out vec4 outColor;
  void main() {
    vec3 c = texture(tSrc, vUv).rgb;
    float l = max(c.r, max(c.g, c.b));
    // Soft knee: a hard cutoff makes edges pop in and out as things cross the threshold, which
    // flickers badly on moving geometry.
    float w = smoothstep(uThreshold - uSoft, uThreshold + uSoft, l);
    outColor = vec4(c * w, 1.0);
  }
`;

const BLUR_FRAG = `
  precision highp float;
  uniform sampler2D tSrc;
  uniform vec2 uDirection;  // texel-sized step, horizontal or vertical
  in vec2 vUv;
  out vec4 outColor;
  void main() {
    // 9-tap gaussian collapsed to 5 samples: each pair of neighbours is fetched once at a weighted
    // midpoint and the bilinear filter does the averaging for free.
    vec3 c = texture(tSrc, vUv).rgb * 0.2270270270;
    c += texture(tSrc, vUv + uDirection * 1.3846153846).rgb * 0.3162162162;
    c += texture(tSrc, vUv - uDirection * 1.3846153846).rgb * 0.3162162162;
    c += texture(tSrc, vUv + uDirection * 3.2307692308).rgb * 0.0702702703;
    c += texture(tSrc, vUv - uDirection * 3.2307692308).rgb * 0.0702702703;
    outColor = vec4(c, 1.0);
  }
`;

const COMPOSITE_FRAG = `
  precision highp float;
  uniform sampler2D tScene;
  uniform sampler2D tLevel0;
  uniform sampler2D tLevel1;
  uniform sampler2D tLevel2;
  uniform sampler2D tLevel3;
  uniform float uStrength;
  in vec2 vUv;
  out vec4 outColor;
  void main() {
    vec3 bloom =
      texture(tLevel0, vUv).rgb +
      texture(tLevel1, vUv).rgb +
      texture(tLevel2, vUv).rgb +
      texture(tLevel3, vUv).rgb;
    vec3 c = texture(tScene, vUv).rgb + bloom * uStrength * 0.25;
    // Reinhard, so the bright cores roll off instead of clipping to flat white.
    outColor = vec4(c / (c + 1.0), 1.0);
  }
`;

const makeTarget = (w: number, h: number) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType, // the whole point: values above 1.0 survive to the bright pass
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });

export const createBloom = (width: number, height: number) => {
  // Scene target needs depth; the blur chain does not.
  const sceneTarget = makeTarget(width, height);
  sceneTarget.depthBuffer = true;

  const levels = Array.from({ length: LEVELS }, (_, i) => makeTarget(width >> (i + 1), height >> (i + 1)));
  const ping = Array.from({ length: LEVELS }, (_, i) => makeTarget(width >> (i + 1), height >> (i + 1)));

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));

  const makeMaterial = (fragmentShader: string, uniforms: Record<string, { value: unknown }>) =>
    new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERT,
      fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });

  const bright = makeMaterial(BRIGHT_FRAG, {
    'tSrc': { value: null },
    'uThreshold': { value: 1 },
    'uSoft': { value: 0.3 },
  });
  const blur = makeMaterial(BLUR_FRAG, {
    'tSrc': { value: null },
    'uDirection': { value: new THREE.Vector2() },
  });
  const composite = makeMaterial(COMPOSITE_FRAG, {
    'tScene': { value: null },
    'tLevel0': { value: null },
    'tLevel1': { value: null },
    'tLevel2': { value: null },
    'tLevel3': { value: null },
    'uStrength': { value: 1 },
  });

  const quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(geometry, bright);
  quadScene.add(quad);
  const quadCamera = new THREE.Camera();

  const draw = (
    renderer: THREE.WebGLRenderer,
    material: THREE.RawShaderMaterial,
    target: THREE.WebGLRenderTarget | null,
  ) => {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCamera);
  };

  return {
    sceneTarget,

    setSize(width: number, height: number) {
      sceneTarget.setSize(Math.max(1, width), Math.max(1, height));
      for (let i = 0; i < LEVELS; i++) {
        const w = Math.max(1, width >> (i + 1));
        const h = Math.max(1, height >> (i + 1));
        levels[i].setSize(w, h);
        ping[i].setSize(w, h);
      }
    },

    render(renderer: THREE.WebGLRenderer, threshold: number, soft: number, strength: number) {
      bright.uniforms.tSrc.value = sceneTarget.texture;
      bright.uniforms.uThreshold.value = threshold;
      bright.uniforms.uSoft.value = soft;
      draw(renderer, bright, levels[0]);

      for (let i = 0; i < LEVELS; i++) {
        // Level 0 blurs itself; the rest read the level above, which is what performs the downsample.
        const src = i === 0 ? levels[0] : levels[i - 1];
        const { width: w, height: h } = levels[i];

        blur.uniforms.tSrc.value = src.texture;
        blur.uniforms.uDirection.value.set(1 / w, 0);
        draw(renderer, blur, ping[i]);

        blur.uniforms.tSrc.value = ping[i].texture;
        blur.uniforms.uDirection.value.set(0, 1 / h);
        draw(renderer, blur, levels[i]);
      }

      composite.uniforms.tScene.value = sceneTarget.texture;
      for (let i = 0; i < LEVELS; i++) composite.uniforms[`tLevel${i}`].value = levels[i].texture;
      composite.uniforms.uStrength.value = strength;
      draw(renderer, composite, null);
    },
  };
};
