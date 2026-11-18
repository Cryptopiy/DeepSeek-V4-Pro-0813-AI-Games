import * as THREE from 'three';
import {
  GRID_COLS,
  GRID_ROWS,
  cellToWorldX,
  cellToWorldZ,
} from '../sim/types';
import { Simulation } from '../sim/simulation';

// Builds a cell-centered heightfield geometry (one vertex per grid cell).
export function buildGridGeometry(): { geometry: THREE.BufferGeometry; indexOf: (cx: number, cz: number) => number } {
  const verts = GRID_COLS * GRID_ROWS;
  const positions = new Float32Array(verts * 3);
  const colors = new Float32Array(verts * 3);
  const uvs = new Float32Array(verts * 2);
  const indexOf = (cx: number, cz: number) => cz * GRID_COLS + cx;

  for (let cz = 0; cz < GRID_ROWS; cz++) {
    for (let cx = 0; cx < GRID_COLS; cx++) {
      const i = indexOf(cx, cz);
      const wx = cellToWorldX(cx);
      const wz = cellToWorldZ(cz);
      positions[i * 3] = wx;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = wz;
      uvs[i * 2] = cx / GRID_COLS;
      uvs[i * 2 + 1] = cz / GRID_ROWS;
    }
  }

  const indices: number[] = [];
  for (let cz = 0; cz < GRID_ROWS - 1; cz++) {
    for (let cx = 0; cx < GRID_COLS - 1; cx++) {
      const a = indexOf(cx, cz);
      const b = indexOf(cx + 1, cz);
      const c = indexOf(cx, cz + 1);
      const d = indexOf(cx + 1, cz + 1);
      indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return { geometry, indexOf };
}

const TERRAIN_PALETTE: Array<[number, [number, number, number]]> = [
  [-26, [0.16, 0.22, 0.26]],
  [-8, [0.22, 0.3, 0.33]],
  [-2, [0.76, 0.66, 0.46]],
  [-1.2, [0.9, 0.82, 0.6]],
  [0, [0.85, 0.76, 0.52]],
  [0.6, [0.5, 0.62, 0.32]],
  [2, [0.42, 0.55, 0.28]],
  [5, [0.38, 0.5, 0.3]],
  [8, [0.5, 0.46, 0.34]],
  [13, [0.55, 0.5, 0.4]],
  [20, [0.72, 0.72, 0.75]],
];

function lerpColor(c1: [number, number, number], c2: [number, number, number], t: number): [number, number, number] {
  return [
    c1[0] + (c2[0] - c1[0]) * t,
    c1[1] + (c2[1] - c1[1]) * t,
    c1[2] + (c2[2] - c1[2]) * t,
  ];
}

export function elevationColor(e: number, out: [number, number, number]): void {
  let c = TERRAIN_PALETTE[0][1];
  for (let i = 0; i < TERRAIN_PALETTE.length - 1; i++) {
    const [e0, c0] = TERRAIN_PALETTE[i];
    const [e1, c1] = TERRAIN_PALETTE[i + 1];
    if (e >= e0 && e <= e1) {
      const t = (e - e0) / (e1 - e0);
      c = lerpColor(c0, c1, t);
      break;
    }
    if (e > e1) c = c1;
  }
  out[0] = c[0];
  out[1] = c[1];
  out[2] = c[2];
}

export function colorizeTerrain(sim: Simulation, geometry: THREE.BufferGeometry): void {
  const colors = geometry.getAttribute('color') as THREE.BufferAttribute;
  const arr = colors.array as Float32Array;
  const road = new THREE.Color(0x3a3f44);
  const building = new THREE.Color(0x4a4a4a);
  const tmp: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < sim.elevation.length; i++) {
    const e = sim.elevation[i];
    elevationColor(e, tmp);
    if (sim.isRoad[i]) {
      arr[i * 3] = road.r;
      arr[i * 3 + 1] = road.g;
      arr[i * 3 + 2] = road.b;
    } else if (sim.isBuilding[i]) {
      arr[i * 3] = building.r;
      arr[i * 3 + 1] = building.g;
      arr[i * 3 + 2] = building.b;
    } else {
      arr[i * 3] = tmp[0];
      arr[i * 3 + 1] = tmp[1];
      arr[i * 3 + 2] = tmp[2];
    }
  }
  colors.needsUpdate = true;
}

export function updateTerrainHeights(sim: Simulation, geometry: THREE.BufferGeometry): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  const arr = pos.array as Float32Array;
  for (let i = 0; i < sim.elevation.length; i++) {
    arr[i * 3 + 1] = sim.elevation[i];
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}

const SHALLOW = new THREE.Color(0x4aa3c7);
const DEEP = new THREE.Color(0x0b3d5c);
const _tmpColor = new THREE.Color();

export function updateWaterSurface(sim: Simulation, geometry: THREE.BufferGeometry): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  const col = geometry.getAttribute('color') as THREE.BufferAttribute;
  const pArr = pos.array as Float32Array;
  const cArr = col.array as Float32Array;
  for (let i = 0; i < sim.water.depth.length; i++) {
    const d = sim.water.depth[i];
    const surf = sim.water.elevation[i] + d;
    // Dry cells are pulled below the terrain so the mesh is hidden.
    pArr[i * 3 + 1] = d > 0.02 ? surf : sim.water.elevation[i] - 0.6;
    const t = Math.min(1, d / 4);
    _tmpColor.copy(SHALLOW).lerp(DEEP, t);
    cArr[i * 3] = _tmpColor.r;
    cArr[i * 3 + 1] = _tmpColor.g;
    cArr[i * 3 + 2] = _tmpColor.b;
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
  geometry.computeVertexNormals();
}
