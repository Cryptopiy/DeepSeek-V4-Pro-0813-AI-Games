export interface Vec2 {
  x: number;
  z: number;
}

export interface Building {
  id: number;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
  roofColor: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  flooded: boolean;
  damaged: boolean;
}

export interface Vehicle {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  w: number;
  d: number;
  h: number;
  mass: number;
  color: string;
  startX: number;
  startZ: number;
  startHeading: number;
  displaced: boolean;
  afloat: boolean;
}

export interface Person {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  targetX: number;
  targetZ: number;
  color: string;
  safe: boolean;
  swept: boolean;
  startX: number;
  startZ: number;
}

export interface Stats {
  elapsed: number;
  floodedFraction: number;
  floodedCells: number;
  landCells: number;
  maxDepth: number;
  floodedBuildings: number;
  damagedBuildings: number;
  displacedVehicles: number;
  totalBuildings: number;
  totalVehicles: number;
  safePeople: number;
  sweptPeople: number;
  totalPeople: number;
  waveActive: boolean;
}

export type SimStatus = 'idle' | 'running' | 'paused';

export interface ControlState {
  waveHeight: number;
  status: SimStatus;
  speed: number;
  showOverlay: boolean;
  showTerrain: boolean;
  overlayOpacity: number;
}

export const GRID_COLS = 128;
export const GRID_ROWS = 128;
export const CELL_SIZE = 2;
export const SEA_COLS = 40;
export const WORLD_W = GRID_COLS * CELL_SIZE;
export const WORLD_D = GRID_ROWS * CELL_SIZE;

export const worldToCellX = (wx: number) => Math.round(wx / CELL_SIZE + SEA_COLS);
export const worldToCellZ = (wz: number) => Math.round(wz / CELL_SIZE + GRID_ROWS / 2);
export const cellToWorldX = (cx: number) => (cx - SEA_COLS) * CELL_SIZE;
export const cellToWorldZ = (cz: number) => (cz - GRID_ROWS / 2) * CELL_SIZE;