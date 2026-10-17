// Draws the lit cells as boxes, every frame from scratch: the floor cells bright enough to see, by the height
// of their wave, and the trail of every drop.
//
// A drop's trail is not stored anywhere. The drop falls at dropSpeed, so a cell `d` cells above the drop's
// head was passed d / dropSpeed seconds ago, and has faded to exp(-(d / dropSpeed) / trailLife) since: the same
// glow the cells would hold if each were lit as the drop went through and left to fade.
import * as THREE from 'three';
import type { Params } from './params.ts';
import { RAIN_CAPACITY, type Rain } from './rain.ts';
import voxelFrag from './voxel.frag.glsl?raw';
import voxelVert from './voxel.vert.glsl?raw';
import type { World } from './world.ts';

export type Voxels = { mesh: THREE.InstancedMesh; update: (world: World, rain: Rain, params: Params, fog: THREE.Fog) => void };

export const createVoxels = (world: World): Voxels => {
  const { nx, nz, h } = world;
  // Every floor cell, and every cell of every column a drop can be in.
  const capacity = nx * nz + RAIN_CAPACITY * h;
  const material = new THREE.ShaderMaterial({
    vertexShader: voxelVert,
    fragmentShader: voxelFrag,
    uniforms: {
      uLight: { value: new THREE.Vector3(0.45, 1, 0.3).normalize() },
      uShade: { value: 0 },
      uEdgeColor: { value: new THREE.Color() },
      uEdgeGain: { value: 0 },
      uEdgeWidth: { value: 0 },
      uFogColor: { value: new THREE.Color() },
      uFogNear: { value: 0 },
      uFogFar: { value: 1 },
    },
  });
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, capacity);
  mesh.frustumCulled = false;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  const matrices = mesh.instanceMatrix.array as Float32Array;
  const colors = mesh.instanceColor.array as Float32Array;
  // The rain's glow on the floor cells, gathered from the trails so the floor draws one box per cell, not two.
  const floorRain = new Float32Array(nx * nz);
  const rain = new THREE.Color();
  const ripple = new THREE.Color();

  return {
    mesh,
    update: (w, drops, params, fog) => {
      const { wave } = w;
      rain.setHex(params.rainColor);
      // rippleEmission scales only the colour: which floor cells are drawn, and where they start to fade, still
      // follow the wave through rippleGain and minGlow.
      ripple.setHex(params.rippleColor).multiplyScalar(params.rippleEmission);
      const size = 1 - params.gap;
      const min = params.minGlow;
      // Brightness just above minGlow is pulled toward black, so a cell fades out instead of vanishing at full
      // brightness: 0 at minGlow, back to its own brightness fadeRange above it.
      const fade = params.fadeRange;
      const faded = (v: number) => (fade > 0 ? Math.min(1, (v - min) / fade) ** 2 : 1);
      const rainB = params.rainBrightness;
      const rippleB = params.rippleGain;
      const halfX = nx / 2;
      const halfZ = nz / 2;
      // How much a trail fades per cell up from the head, as an exponent: a cell is 1 / dropSpeed seconds older.
      const step = 1 / (params.dropSpeed * params.trailLife); // and divided by the drop's own trail length
      let count = 0;

      const put = (x: number, y: number, z: number, g: number, r: number, scale = 1, lift = 0) => {
        const o = count * 16;
        matrices[o] = size * scale;
        matrices[o + 5] = size * scale;
        matrices[o + 10] = size * scale;
        matrices[o + 12] = x - halfX + 0.5;
        matrices[o + 13] = y + 0.5 + lift;
        matrices[o + 14] = z - halfZ + 0.5;
        matrices[o + 15] = 1;
        const f = faded(g + r);
        colors[count * 3] = (rain.r * g + ripple.r * r) * f;
        colors[count * 3 + 1] = (rain.g * g + ripple.g * r) * f;
        colors[count * 3 + 2] = (rain.b * g + ripple.b * r) * f;
        count++;
      };

      for (let k = 0; k < drops.count; k++) {
        const x = drops.x[k]!;
        const z = drops.z[k]!;
        const head = drops.y[k]!;
        const fall = step / drops.trail[k]!;
        // The cell the head is in is lit fully; each cell above it is one cell older. Up to where it fades out.
        const bottom = Math.max(0, Math.floor(head));
        // Not above where it appeared: a click drops it from mid-air, and it has come from nowhere higher.
        const top = Math.min(h, Math.ceil(drops.top[k]!));
        for (let y = bottom; y < top; y++) {
          const g = Math.exp(-Math.max(0, y - head) * fall) * rainB;
          if (g < min) break;
          if (y === 0) floorRain[z * nx + x] = Math.max(floorRain[z * nx + x]!, g);
          else put(x, y, z, g, 0);
        }
      }

      for (let z = 0; z < nz; z++) {
        for (let x = 0; x < nx; x++) {
          const k = z * nx + x;
          const g = floorRain[k]!;
          floorRain[k] = 0;
          const r = Math.min(Math.abs(wave[k]!) * rippleB, params.rippleMax);
          // A floor cell is as big as it is bright: rippleSizeMax where the wave is strongest (rippleMax), shrinking to
          // rippleSizeMin as it fades out to minGlow.
          const v = g + r;
          if (v < min) continue;
          const t = Math.min(1, (v - min) / Math.max(1e-3, params.rippleMax - min));
          // And it rides the wave: up on a crest, down in a trough.
          const lift = wave[k]! * params.rippleHeight;
          put(x, 0, z, g, r, params.rippleSizeMin + (params.rippleSizeMax - params.rippleSizeMin) * t, lift);
        }
      }

      mesh.count = count;
      // Upload only the instances filled this frame, not the whole buffer.
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(0, count * 16);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor!.clearUpdateRanges();
      mesh.instanceColor!.addUpdateRange(0, count * 3);
      mesh.instanceColor!.needsUpdate = true;
      material.uniforms.uShade!.value = params.shade;
      (material.uniforms.uEdgeColor!.value as THREE.Color).setHex(params.edgeColor);
      material.uniforms.uEdgeGain!.value = params.edgeGain;
      material.uniforms.uEdgeWidth!.value = params.edgeWidth;
      (material.uniforms.uFogColor!.value as THREE.Color).copy(fog.color);
      material.uniforms.uFogNear!.value = fog.near;
      material.uniforms.uFogFar!.value = fog.far;
    },
  };
};
