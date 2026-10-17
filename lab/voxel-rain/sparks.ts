// Sparks where a click or drag drop appears: a few small points of light burst out from it and fade, in their
// own colour, so the moment a drop comes out of the air reads without lighting up whole cells.
import * as THREE from 'three';
import type { Params } from './params.ts';

export type Sparks = {
  object: THREE.Points;
  emit: (x: number, y: number, z: number, params: Params) => void;
  step: (deltaTime: number) => void;
  update: (params: Params) => void;
  clear: () => void;
};

const CAPACITY = 1024;
// The share of its speed a spark keeps after a second: they burst out and slow down instead of flying off.
const DRAG = 0.02;

export const createSparks = (): Sparks => {
  let count = 0;
  const position = new Float32Array(CAPACITY * 3);
  const velocity = new Float32Array(CAPACITY * 3);
  const age = new Float32Array(CAPACITY);
  const life = new Float32Array(CAPACITY);
  const color = new Float32Array(CAPACITY * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
  const material = new THREE.PointsMaterial({
    sizeAttenuation: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  const object = new THREE.Points(geometry, material);
  object.frustumCulled = false;
  const tint = new THREE.Color();

  const kill = (k: number) => {
    const last = --count;
    position.copyWithin(k * 3, last * 3, last * 3 + 3);
    velocity.copyWithin(k * 3, last * 3, last * 3 + 3);
    age[k] = age[last]!;
    life[k] = life[last]!;
  };

  return {
    object,
    emit: (x, y, z, params) => {
      for (let n = 0; n < params.sparkCount && count < CAPACITY; n++) {
        const k = count++;
        // A direction uniform over the sphere, at between half and all of sparkSpeed.
        const u = Math.random() * 2 - 1;
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(1 - u * u);
        const speed = params.sparkSpeed * (0.5 + 0.5 * Math.random());
        position.set([x, y, z], k * 3);
        velocity.set([r * Math.cos(a) * speed, u * speed, r * Math.sin(a) * speed], k * 3);
        age[k] = 0;
        life[k] = params.sparkLife * (0.6 + 0.4 * Math.random());
      }
    },
    step: (deltaTime) => {
      const keep = DRAG ** deltaTime;
      for (let k = count - 1; k >= 0; k--) {
        age[k]! += deltaTime;
        if (age[k]! >= life[k]!) {
          kill(k);
          continue;
        }
        for (let i = k * 3; i < k * 3 + 3; i++) {
          velocity[i]! *= keep;
          position[i]! += velocity[i]! * deltaTime;
        }
      }
    },
    update: (params) => {
      tint.setHex(params.sparkColor).multiplyScalar(params.sparkGain);
      for (let k = 0; k < count; k++) {
        // Additive, so dimming is fading: out over its life, faster toward the end.
        const f = (1 - age[k]! / life[k]!) ** 2;
        color.set([tint.r * f, tint.g * f, tint.b * f], k * 3);
      }
      geometry.setDrawRange(0, count);
      geometry.attributes.position!.needsUpdate = true;
      geometry.attributes.color!.needsUpdate = true;
      // PointsMaterial attenuates by distance alone, without the field of view: dividing by tan(fov / 2) makes
      // sparkSize a size in cells, like everything else.
      material.size = params.sparkSize / Math.tan((params.camFov * Math.PI) / 360);
      object.visible = params.sparkCount > 0;
    },
    clear: () => {
      count = 0;
    },
  };
};
