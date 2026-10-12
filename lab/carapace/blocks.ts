// Cell[] -> InstancedMesh, and the per-frame matrix update. Plumbing: this file only moves numbers that
// subdivide / height / growth decided, and splits the field into the two materials it is drawn with.
import * as THREE from 'three';
import { cellDelay, growth } from './growth.ts';
import { hashCell } from './hash.ts';
import { cellHeight } from './height.ts';
import type { Params } from './params.ts';
import { createFrame, type Surface } from './surface.ts';
import type { Cell } from './subdivide.ts';

export type Blocks = {
  'mesh': THREE.InstancedMesh;
  'cells': Cell[];
  'heights': number[];
  'delays': number[];
};

// A few of the long thin footprints become emissive bars. Picking them by *aspect ratio* and not by hash
// alone is the whole trick: long cells already run along the grid axes, so the glow comes out as traces on
// a board rather than as scattered glowing cubes.
const isBar = (cell: Cell, params: Params): boolean => {
  const long = Math.max(cell.w, cell.d);
  const short = Math.min(cell.w, cell.d);
  // Thin as well as long. Aspect ratio alone also matches big rectangles, and a lit slab the size of a
  // district reads as a mistake, not as a trace.
  if (short > params['minSide'] * 2.5) return false;
  return long / short >= params['barAspect'] && hashCell(cell, params['seed'] + 4919) < params['barRate'];
};

// Pivot at the bottom face, so scaling y grows the box upward instead of from its centre. Doing it in the
// geometry keeps the per-instance matrix a plain compose() with no corrective offset.
const boxGeometry = () => {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  geometry.translate(0, 0.5, 0);
  return geometry;
};

const createBlocks = (cells: Cell[], params: Params, material: THREE.Material, heightScale = 1): Blocks => {
  // InstancedMesh wants at least one slot; count is what actually gets drawn.
  const mesh = new THREE.InstancedMesh(boxGeometry(), material, Math.max(cells.length, 1));
  mesh.count = cells.length;
  mesh.frustumCulled = false; // one draw call over the whole field; its bounding sphere means nothing
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return {
    'mesh': mesh,
    'cells': cells,
    // Static per-instance data, computed once. Only the growth factor changes per frame.
    'heights': cells.map((cell) => cellHeight(cell, params) * heightScale),
    'delays': cells.map((cell) => cellDelay(cell, params)),
  };
};

// Two meshes, not one with per-instance colour: the bars need `emissive`, which is a material property and
// cannot vary per instance. Two draw calls is still two.
export const createField = (cells: Cell[], params: Params): Blocks[] => {
  const bars: Cell[] = [];
  const mass: Cell[] = [];
  for (const cell of cells) (isBar(cell, params) ? bars : mass).push(cell);

  // Low metalness on purpose. At 0.9 a standard material has almost no diffuse term, so it stops responding
  // to the directional lights and only shows what the environment map reflects -- which, with
  // RoomEnvironment as a stand-in for a real HDRI, is nearly nothing. Painted metal reads better here than
  // bare metal, and it is what lets the key / rim knobs actually do something.
  const massMaterial = new THREE.MeshStandardMaterial({ color: 0x6b7680, roughness: 0.55, metalness: 0.2 });
  const barMaterial = new THREE.MeshStandardMaterial({
    color: 0x120a07,
    roughness: 0.3,
    metalness: 0.6,
    emissive: 0xff5a28,
    emissiveIntensity: params['emissive'],
  });

  // Bars are kept flat. Given the same height as everything else they come out as thin glowing *walls*,
  // which reads as signage; lying along the ground they read as traces on a board, which is the reference.
  return [createBlocks(mass, params, massMaterial), createBlocks(bars, params, barMaterial, params['barHeight'])];
};

export const disposeField = (field: Blocks[]) => {
  for (const blocks of field) {
    blocks['mesh'].geometry.dispose();
    (blocks['mesh'].material as THREE.Material).dispose();
    blocks['mesh'].dispose();
  }
};

const matrix = new THREE.Matrix4();
const frame = createFrame();
const xAxis = new THREE.Vector3();
const zAxis = new THREE.Vector3();
const scale = new THREE.Vector3();

// Every frame, for every instance. The body moves, so the whole field has to be re-placed -- unlike the
// flat version, where only the y scale changed. This is the per-frame cost of putting greeble on something
// alive; the perf folder in the pane is how you find out whether a phone can afford it.
export const updateBlocks = (blocks: Blocks, time: number, params: Params, surface: Surface) => {
  const cells = blocks['cells'];
  const size = params['size'];
  const gap = params['gap'];
  // Heights come out of height.ts in domain units, the same units the subdivision uses. Scaling them by
  // radius/size keeps the greeble the same size *relative to the body* as it was relative to the plane.
  const heightScale = params['radius'] / size;

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    const g = growth(time, blocks['delays'][i]!, params);

    // The cell's centre and extent, as fractions of the UV domain.
    surface['at']((cell.x + cell.w / 2) / size + 0.5, (cell.z + cell.d / 2) / size + 0.5, time, frame);

    xAxis.copy(frame['tangent']);
    zAxis.crossVectors(xAxis, frame['normal']); // right-handed with y = normal
    matrix.makeBasis(xAxis, frame['normal'], zAxis);

    // A floor on every axis: a zero scale collapses the matrix and the normals go undefined (black flicker).
    scale.set(
      Math.max(((cell.w - gap) / size) * frame['scaleU'], 0.0001),
      Math.max(blocks['heights'][i]! * g * heightScale, 0.0001),
      Math.max(((cell.d - gap) / size) * frame['scaleV'], 0.0001),
    );
    matrix.scale(scale);
    matrix.setPosition(frame['position']);
    blocks['mesh'].setMatrixAt(i, matrix);
  }

  blocks['mesh'].instanceMatrix.needsUpdate = true;
};
