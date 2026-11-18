import {
  GRID_COLS,
  GRID_ROWS,
  SEA_COLS,
  CELL_SIZE,
  cellToWorldX,
  cellToWorldZ,
  worldToCellX,
  worldToCellZ,
  Building,
  Vehicle,
  Person,
} from './types';
import { fbm2, gauss, mulberry32 } from './noise';

export interface TerrainData {
  elevation: Float32Array;
  isOcean: Uint8Array;
  isRoad: Uint8Array;
  isBuilding: Uint8Array;
}

// Elevation model (meters, sea level = 0). Ocean is west (x < SEA_COLS).
function elevationAt(wx: number, wz: number, seed: number): number {
  if (wx < 0) {
    // Ocean floor sloping down to the west.
    const t = Math.min(1, (-wx) / 120);
    return -1.5 - t * 24;
  }
  // Land: gentle rise from the shore.
  const x = wx;
  const base = 0.5 + x * 0.05;
  let e = base;
  // gentle noise
  const n = fbm2(x * 0.045, wz * 0.045, seed, 4);
  e += (n - 0.5) * 2.2;
  // safe hill (elevated, stays dry for small waves)
  e += gauss(x - 120, wz - 25, 20) * 7.5;
  // secondary hill
  e += gauss(x - 75, wz + 55, 16) * 4.2;
  // far hill
  e += gauss(x - 95, wz - 90, 18) * 3.6;
  // depression (landlocked basin that collects water)
  e -= gauss(x - 28, wz + 18, 11) * 2.3;
  return e;
}

// Road definition (world coords): axis-aligned strips.
interface Road {
  axis: 'x' | 'z';
  at: number;
  from: number;
  to: number;
  width: number;
}

const ROADS: Road[] = [
  { axis: 'z', at: 6, from: -120, to: 120, width: 3.2 }, // coastal road
  { axis: 'x', at: 0, from: -10, to: 172, width: 3.2 }, // main avenue
  { axis: 'x', at: -50, from: -10, to: 150, width: 3.0 },
  { axis: 'x', at: 50, from: -10, to: 150, width: 3.0 },
  { axis: 'z', at: 20, from: -70, to: 70, width: 2.6 },
  { axis: 'z', at: 40, from: -70, to: 70, width: 2.6 },
  { axis: 'z', at: 60, from: -70, to: 70, width: 2.6 },
  { axis: 'x', at: -25, from: 0, to: 100, width: 2.6 },
  { axis: 'x', at: 25, from: 0, to: 100, width: 2.6 },
];

function roadLevelAt(wx: number): number {
  return 0.25 + wx * 0.03;
}

function onRoad(wx: number, wz: number): boolean {
  for (const r of ROADS) {
    if (r.axis === 'x') {
      if (Math.abs(wz - r.at) < r.width / 2 && wx >= r.from && wx <= r.to) return true;
    } else {
      if (Math.abs(wx - r.at) < r.width / 2 && wz >= r.from && wz <= r.to) return true;
    }
  }
  return false;
}

export function buildTerrain(seed: number): TerrainData {
  const elevation = new Float32Array(GRID_COLS * GRID_ROWS);
  const isOcean = new Uint8Array(GRID_COLS * GRID_ROWS);
  const isRoad = new Uint8Array(GRID_COLS * GRID_ROWS);

  for (let cz = 0; cz < GRID_ROWS; cz++) {
    for (let cx = 0; cx < GRID_COLS; cx++) {
      const i = cz * GRID_COLS + cx;
      const wx = cellToWorldX(cx);
      const wz = cellToWorldZ(cz);
      const ocean = wx < -2;
      let e = elevationAt(wx, wz, seed);
      if (ocean) {
        e = Math.min(e, -1.2);
      } else if (onRoad(wx, wz)) {
        const rl = roadLevelAt(wx);
        e = Math.min(e, rl);
        isRoad[i] = 1;
      }
      // Force a shallow beach right at the shoreline so the wave reads clearly.
      if (!ocean && wx < 6) {
        e = Math.min(e, 0.3);
      }
      // flatten near shore slightly so the beach reads clearly
      elevation[i] = e;
      isOcean[i] = ocean ? 1 : 0;
    }
  }
  return { elevation, isOcean, isRoad, isBuilding: new Uint8Array(GRID_COLS * GRID_ROWS) };
}

export interface SceneObjects {
  buildings: Building[];
  vehicles: Vehicle[];
  people: Person[];
  safeHill: { x: number; z: number };
}

const BUILDING_COLORS = ['#d9c7a8', '#cbb394', '#e0d3b8', '#c2b49a', '#d6c6a5', '#b8a98c'];
const ROOF_COLORS = ['#8a5a3b', '#6f4a30', '#9c6b4a', '#7a4f35', '#8f5f42', '#6b472e'];

export function buildObjects(seed: number): SceneObjects {
  const rng = mulberry32(seed);
  const buildings: Building[] = [];
  const vehicles: Vehicle[] = [];
  const people: Person[] = [];

  // Buildings on city blocks (between roads), keeping clear of roads and the safe hill.
  const blockCenters: Array<[number, number]> = [];
  for (const wx of [12, 30, 50, 70]) {
    for (const wz of [-70, -37, -12, 12, 37, 70]) {
      blockCenters.push([wx, wz]);
    }
  }
  // a few buildings further inland along the main avenue
  blockCenters.push([90, 0], [105, 0], [120, -15]);

  let id = 0;
  for (const [bx, bz] of blockCenters) {
    // skip buildings that would sit on the safe hill top
    if (Math.hypot(bx - 120, bz - 25) < 26) continue;
    if (Math.hypot(bx - 75, bz + 55) < 18) continue;
    const w = 5 + rng() * 5;
    const d = 5 + rng() * 5;
    const h = 5 + rng() * 15;
    const jx = (rng() - 0.5) * 4;
    const jz = (rng() - 0.5) * 4;
    const x = bx + jx;
    const z = bz + jz;
    buildings.push({
      id: id++,
      x,
      z,
      w,
      d,
      h,
      color: BUILDING_COLORS[Math.floor(rng() * BUILDING_COLORS.length)],
      roofColor: ROOF_COLORS[Math.floor(rng() * ROOF_COLORS.length)],
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      flooded: false,
      damaged: false,
    });
  }

  // Vehicles on roads.
  const carColors = ['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#e9c46a', '#8d99ae', '#b5179e', '#3a86ff'];
  const carSpots: Array<[number, number, number]> = [
    // [x, z, heading]
    [16, -18, Math.PI / 2], [28, -18, Math.PI / 2], [40, -18, Math.PI / 2],
    [52, 12, -Math.PI / 2], [52, 26, -Math.PI / 2],
    [16, 62, Math.PI / 2], [28, 62, Math.PI / 2],
    [64, -52, 0], [78, -52, 0],
    [64, 52, 0], [78, 52, 0],
    [86, 6, Math.PI / 2], [86, -6, Math.PI / 2],
  ];
  let vid = 0;
  for (const [sx, sz, heading] of carSpots) {
    vehicles.push({
      id: vid++,
      x: sx,
      z: sz,
      vx: 0,
      vz: 0,
      heading,
      w: 2.0,
      d: 4.2,
      h: 1.4,
      mass: 1400 + rng() * 600,
      color: carColors[Math.floor(rng() * carColors.length)],
      startX: sx,
      startZ: sz,
      startHeading: heading,
      displaced: false,
      afloat: false,
    });
  }

  // People scattered in the city; they evacuate to the safe hill.
  const personColors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a29bfe', '#fd79a8', '#55efc4'];
  const safeHill = { x: 120, z: 25 };
  const peopleSpots: Array<[number, number]> = [
    [18, -30], [26, -6], [38, 8], [48, -40], [56, -10],
    [62, 20], [34, 40], [44, -60], [22, 28], [70, 30],
  ];
  let pid = 0;
  for (const [px, pz] of peopleSpots) {
    people.push({
      id: pid++,
      x: px,
      z: pz,
      vx: 0,
      vz: 0,
      targetX: safeHill.x + (rng() - 0.5) * 20,
      targetZ: safeHill.z + (rng() - 0.5) * 20,
      color: personColors[Math.floor(rng() * personColors.length)],
      safe: false,
      swept: false,
      startX: px,
      startZ: pz,
    });
  }

  return { buildings, vehicles, people, safeHill };
}

export function sampleElevation(elevation: Float32Array, wx: number, wz: number): number {
  const cx = Math.max(0, Math.min(GRID_COLS - 1, worldToCellX(wx)));
  const cz = Math.max(0, Math.min(GRID_ROWS - 1, worldToCellZ(wz)));
  return elevation[cz * GRID_COLS + cx];
}

export function bilinearDepth(
  depth: Float32Array,
  wx: number,
  wz: number,
): number {
  const fx = wx / CELL_SIZE + SEA_COLS;
  const fz = wz / CELL_SIZE + GRID_ROWS / 2;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const x1 = x0 + 1;
  const z1 = z0 + 1;
  const tx = fx - x0;
  const tz = fz - z0;
  const cx0 = Math.max(0, Math.min(GRID_COLS - 1, x0));
  const cx1 = Math.max(0, Math.min(GRID_COLS - 1, x1));
  const cz0 = Math.max(0, Math.min(GRID_ROWS - 1, z0));
  const cz1 = Math.max(0, Math.min(GRID_ROWS - 1, z1));
  const v00 = depth[cz0 * GRID_COLS + cx0];
  const v10 = depth[cz0 * GRID_COLS + cx1];
  const v01 = depth[cz1 * GRID_COLS + cx0];
  const v11 = depth[cz1 * GRID_COLS + cx1];
  const a = v00 * (1 - tx) + v10 * tx;
  const b = v01 * (1 - tx) + v11 * tx;
  return a * (1 - tz) + b * tz;
}

export function bilinearVelocity(
  u: Float32Array,
  v: Float32Array,
  wx: number,
  wz: number,
): { u: number; v: number } {
  const fx = wx / CELL_SIZE + SEA_COLS;
  const fz = wz / CELL_SIZE + GRID_ROWS / 2;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const x1 = x0 + 1;
  const z1 = z0 + 1;
  const tx = fx - x0;
  const tz = fz - z0;
  const cx0 = Math.max(0, Math.min(GRID_COLS - 1, x0));
  const cx1 = Math.max(0, Math.min(GRID_COLS - 1, x1));
  const cz0 = Math.max(0, Math.min(GRID_ROWS - 1, z0));
  const cz1 = Math.max(0, Math.min(GRID_ROWS - 1, z1));
  const u00 = u[cz0 * GRID_COLS + cx0];
  const u10 = u[cz0 * GRID_COLS + cx1];
  const u01 = u[cz1 * GRID_COLS + cx0];
  const u11 = u[cz1 * GRID_COLS + cx1];
  const v00 = v[cz0 * GRID_COLS + cx0];
  const v10 = v[cz0 * GRID_COLS + cx1];
  const v01 = v[cz1 * GRID_COLS + cx0];
  const v11 = v[cz1 * GRID_COLS + cx1];
  const ua = u00 * (1 - tx) + u10 * tx;
  const ub = u01 * (1 - tx) + u11 * tx;
  const va = v00 * (1 - tx) + v10 * tx;
  const vb = v01 * (1 - tx) + v11 * tx;
  return { u: ua * (1 - tz) + ub * tz, v: va * (1 - tz) + vb * tz };
}
