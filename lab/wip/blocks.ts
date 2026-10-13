// Cell[] -> InstancedMesh, and the per-frame matrix update. Plumbing: this file only moves numbers that
// subdivide / height / growth decided, and splits the field into the two materials it is drawn with.
import * as THREE from 'three';
import { cellDelay, growth } from './growth.ts';
import { hashCell } from './hash.ts';
import { cellHeight } from './height.ts';
import type { Params } from './params.ts';
import type { Plates } from './lift.ts';
import { createFrame, type Surface } from './surface.ts';
import type { Rect } from './subdivide.ts';
import type { Cell } from './subdivide.ts';

export type Blocks = {
  'mesh': THREE.InstancedMesh;
  'cells': Cell[];
  'heights': number[];
  'delays': number[];
  'plateIdx': Int32Array; // which plate each cell belongs to, for the pointer lift
  'bar': boolean; // which of the two materials this half of the field wears, so the palette can find it
};

// A few of the long thin footprints become emissive bars. Picking them by *aspect ratio* and not by hash
// alone is the whole trick: long cells already run along the grid axes, so the glow comes out as traces on
// a board rather than as scattered glowing cubes.
const isBar = (cell: Cell, params: Params): boolean => {
  // On the plate, so a long thin panel glows along its whole length instead of breaking into lit fragments.
  const plate = cell.plate;
  const long = Math.max(plate.w, plate.d);
  const short = Math.min(plate.w, plate.d);
  // Thin as well as long. Aspect ratio alone also matches big rectangles, and a lit slab the size of a
  // district reads as a mistake, not as a trace. Measured against plateSize, not minSide: the threshold
  // has to scale with what a panel IS, or changing plateSize silently turns the traces off.
  if (short > params['plateSize'] * 0.35) return false;
  return long / short >= params['barAspect'] && hashCell(plate, params['seed'] + 4919) < params['barRate'];
};

// Pivot at the bottom face, so scaling y grows the box upward instead of from its centre. Doing it in the
// geometry keeps the per-instance matrix a plain compose() with no corrective offset.
const boxGeometry = () => {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  geometry.translate(0, 0.5, 0);
  return geometry;
};

const createBlocks = (
  cells: Cell[],
  params: Params,
  material: THREE.Material,
  plates: Plates,
  bar: boolean,
  heightScale = 1,
): Blocks => {
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
    'plateIdx': Int32Array.from(cells, (cell) => plates['indexOf'](cell)),
    'bar': bar,
  };
};

// The UV of a point in the subdivision domain. The domain is square and centred on the origin; UV is the
// unit square. One place, so the filter below and the per-frame placement cannot disagree.
const uvOf = (x: number, z: number, size: number): [number, number] => [x / size + 0.5, z / size + 0.5];

// Drop the cells that land in the gaps between UV islands.
//
// Centre AND corners: a panel whose centre is on an island but whose corner is not would hang off the edge
// of the facet. The corners are pulled slightly inward because an island's own boundary is exactly where
// the unwrap put its margin, and a corner sitting exactly on it is a coin flip.
const onSurface = (cell: Rect, params: Params, surface: Surface, probe: ReturnType<typeof createFrame>) => {
  const size = params['size'];
  const inset = 0.02;
  const corners: [number, number][] = [
    [cell.x + cell.w / 2, cell.z + cell.d / 2],
    [cell.x + cell.w * inset, cell.z + cell.d * inset],
    [cell.x + cell.w * (1 - inset), cell.z + cell.d * inset],
    [cell.x + cell.w * inset, cell.z + cell.d * (1 - inset)],
    [cell.x + cell.w * (1 - inset), cell.z + cell.d * (1 - inset)],
  ];
  for (const [x, z] of corners) {
    const [u, v] = uvOf(x, z, size);
    if (!surface['at'](u, v, 0, probe)) return false;
  }
  return true;
};

// Two meshes, not one with per-instance colour: the bars need `emissive`, which is a material property and
// cannot vary per instance. Two draw calls is still two.
export const createField = (cells: Cell[], params: Params, surface: Surface, plates: Plates): Blocks[] => {
  const probe = createFrame();
  const bars: Cell[] = [];
  const mass: Cell[] = [];
  for (const cell of cells) {
    if (!onSurface(cell, params, surface, probe)) continue;
    (isBar(cell, params) ? bars : mass).push(cell);
  }

  // Nothing about the look is decided here: both materials are built empty and then written every frame
  // by applyMaterials from params, so colour, roughness and metalness are knobs rather than code.
  const massMaterial = new THREE.MeshStandardMaterial();
  const barMaterial = new THREE.MeshStandardMaterial();

  // Bars are kept flat. Given the same height as everything else they come out as thin glowing *walls*,
  // which reads as signage; lying along the ground they read as traces on a board, which is the reference.
  return [
    createBlocks(mass, params, massMaterial, plates, false),
    createBlocks(bars, params, barMaterial, plates, true, params['barHeight']),
  ];
};

// Every frame. All of this is uniform assignment -- no shader recompiles, no buffer reallocation -- so the
// whole palette can be live. Metalness in particular has to be live to be tunable at all: a metal with
// nothing to reflect renders black, so its usable range depends entirely on the environment map, and
// finding the pair by eye is the only way.
export const applyMaterials = (field: Blocks[], params: Params) => {
  for (const blocks of field) {
    const material = blocks['mesh'].material as THREE.MeshStandardMaterial;
    if (blocks['bar']) {
      material.color.setHex(params['barColor']);
      material.roughness = params['barRough'];
      material.metalness = params['barMetal'];
      material.emissive.setHex(params['barEmissive']);
      material.emissiveIntensity = params['emissive'];
    } else {
      material.color.setHex(params['massColor']);
      material.roughness = params['massRough'];
      material.metalness = params['massMetal'];
    }
  }
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
// Coordinates come out of the same arithmetic as the plate's, so an edge that was inherited unchanged
// compares exactly equal; the epsilon only guards against a cut landing a float apart.
const EDGE = 1e-9;

export const updateBlocks = (
  blocks: Blocks,
  time: number,
  params: Params,
  surface: Surface,
  plates: Plates,
) => {
  const cells = blocks['cells'];
  const size = params['size'];
  const gap = params['gap'];
  // Heights come out of height.ts in domain units. On the plane the domain IS the world (createPlaneSurface
  // maps them 1:1), so they need no conversion. A curved body did need one, and the leftover `params.radius`
  // from that version silently turned every scale into NaN here -- nothing rendered and nothing complained.
  const heightScale = 1;

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    const g = growth(time, blocks['delays'][i]!, params);
    // The pointer's contribution is added, not multiplied: a plate that is naturally flat should still
    // rise when pushed, and a tall one should not shoot off the screen.
    const lifted = blocks['heights'][i]! * g + plates['lift'][blocks['plateIdx'][i]!]! * params['liftHeight'];

    // Inset only where the leaf's edge IS the plate's edge. Inside a plate the boxes stay flush and fuse
    // into one panel; the gap then reads as a trench between panels rather than as grout between tiles.
    const plate = cell.plate;
    const half = gap / 2;
    const x0 = cell.x + (cell.x <= plate.x + EDGE ? half : 0);
    const x1 = cell.x + cell.w - (cell.x + cell.w >= plate.x + plate.w - EDGE ? half : 0);
    const z0 = cell.z + (cell.z <= plate.z + EDGE ? half : 0);
    const z1 = cell.z + cell.d - (cell.z + cell.d >= plate.z + plate.d - EDGE ? half : 0);

    const [u, v] = uvOf((x0 + x1) / 2, (z0 + z1) / 2, size);
    surface['at'](u, v, time, frame);

    xAxis.copy(frame['tangent']);
    zAxis.crossVectors(xAxis, frame['normal']); // right-handed with y = normal
    matrix.makeBasis(xAxis, frame['normal'], zAxis);

    // A floor on every axis: a zero scale collapses the matrix and the normals go undefined (black flicker).
    scale.set(
      Math.max(((x1 - x0) / size) * frame['scaleU'], 0.0001),
      Math.max(lifted * heightScale, 0.0001),
      Math.max(((z1 - z0) / size) * frame['scaleV'], 0.0001),
    );
    matrix.scale(scale);
    matrix.setPosition(frame['position']);
    blocks['mesh'].setMatrixAt(i, matrix);
  }

  blocks['mesh'].instanceMatrix.needsUpdate = true;
};
