import {
  GRID_COLS,
  GRID_ROWS,
  Stats,
  SimStatus,
  Building,
  Vehicle,
  Person,
} from './types';
import { buildTerrain, buildObjects, sampleElevation } from './terrain';
import { createWaterState, stepWater, surfaceLevel } from './water';
import { stepVehicles, stepPeople } from './objects';

const FLOOD_THRESHOLD = 0.05;

export class Simulation {
  elevation: Float32Array;
  isOcean: Uint8Array;
  isRoad: Uint8Array;
  isBuilding: Uint8Array;
  buildings: Building[];
  vehicles: Vehicle[];
  people: Person[];
  water;
  safeHill: { x: number; z: number };

  waveHeight = 8;
  status: SimStatus = 'idle';
  speed = 1;
  eventTime = 0;
  waveActive = false;
  private initialized = false;

  constructor(seed = 20240819) {
    const terrain = buildTerrain(seed);
    this.elevation = terrain.elevation;
    this.isOcean = terrain.isOcean;
    this.isRoad = terrain.isRoad;
    this.isBuilding = terrain.isBuilding;

    const objs = buildObjects(seed + 7);
    this.buildings = objs.buildings;
    this.vehicles = objs.vehicles;
    this.people = objs.people;
    this.safeHill = objs.safeHill;

    // Mark building footprints in the grid and flatten their pads.
    for (const b of this.buildings) {
      const cx0 = Math.max(0, Math.floor(b.minX / 2 + 40));
      const cx1 = Math.min(GRID_COLS - 1, Math.ceil(b.maxX / 2 + 40));
      const cz0 = Math.max(0, Math.floor(b.minZ / 2 + GRID_ROWS / 2));
      const cz1 = Math.min(GRID_ROWS - 1, Math.ceil(b.maxZ / 2 + GRID_ROWS / 2));
      const pad = sampleElevation(this.elevation, b.x, b.z);
      for (let cz = cz0; cz <= cz1; cz++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const idx = cz * GRID_COLS + cx;
          this.isBuilding[idx] = 1;
          this.elevation[idx] = pad;
        }
      }
    }

    this.water = createWaterState(this.elevation, this.isOcean, this.isBuilding);
    this.fillCalmOcean();
    this.initialized = true;
  }

  // Fill ocean cells to calm sea level (0 m) so the sea is visible pre-event.
  private fillCalmOcean(): void {
    for (let i = 0; i < this.water.depth.length; i++) {
      if (this.isOcean[i]) {
        this.water.depth[i] = Math.max(0, -this.elevation[i]);
      }
    }
  }

  start(): void {
    this.reset();
    this.status = 'running';
    this.waveActive = true;
    this.eventTime = 0;
  }

  pause(): void {
    if (this.status === 'running') this.status = 'paused';
    else if (this.status === 'paused') this.status = 'running';
  }

  reset(): void {
    this.status = 'idle';
    this.waveActive = false;
    this.eventTime = 0;
    this.water.depth.fill(0);
    this.water.u.fill(0);
    this.water.v.fill(0);
    this.fillCalmOcean();
    for (const v of this.vehicles) {
      v.x = v.startX;
      v.z = v.startZ;
      v.vx = 0;
      v.vz = 0;
      v.heading = v.startHeading;
      v.displaced = false;
      v.afloat = false;
    }
    for (const p of this.people) {
      p.x = p.startX;
      p.z = p.startZ;
      p.safe = false;
      p.swept = false;
      p.vx = 0;
      p.vz = 0;
    }
    for (const b of this.buildings) {
      b.flooded = false;
      b.damaged = false;
    }
  }

  // Advance simulation by dt seconds (real time), scaled by speed.
  step(dt: number): void {
    if (!this.initialized || this.status !== 'running') return;
    const sdt = Math.min(dt, 1 / 15) * this.speed;
    this.eventTime += sdt;

    const substeps = 3;
    const h = sdt / substeps;
    for (let i = 0; i < substeps; i++) {
      stepWater(this.water, h, this.waveHeight, this.waveActive, this.eventTime);
      stepVehicles(this.vehicles, this.water, this.buildings, h);
      stepPeople(this.people, this.water, h, 6);
    }
  }

  getStats(): Stats {
    const n = GRID_COLS * GRID_ROWS;
    let landCells = 0;
    let floodedCells = 0;
    let maxDepth = 0;
    for (let i = 0; i < n; i++) {
      if (this.isOcean[i]) continue;
      landCells++;
      const d = this.water.depth[i];
      if (d > FLOOD_THRESHOLD) floodedCells++;
      if (d > maxDepth) maxDepth = d;
    }

    let floodedBuildings = 0;
    let damagedBuildings = 0;
    for (const b of this.buildings) {
      const d = this.maxDepthAroundBuilding(b);
      b.flooded = d > 0.15;
      b.damaged = d > 1.5;
      if (b.flooded) floodedBuildings++;
      if (b.damaged) damagedBuildings++;
    }

    let displaced = 0;
    for (const v of this.vehicles) if (v.displaced) displaced++;

    let safePeople = 0;
    let sweptPeople = 0;
    for (const p of this.people) {
      if (p.safe) safePeople++;
      if (p.swept) sweptPeople++;
    }

    return {
      elapsed: this.eventTime,
      floodedFraction: landCells > 0 ? floodedCells / landCells : 0,
      floodedCells,
      landCells,
      maxDepth,
      floodedBuildings,
      damagedBuildings,
      displacedVehicles: displaced,
      totalBuildings: this.buildings.length,
      totalVehicles: this.vehicles.length,
      safePeople,
      sweptPeople,
      totalPeople: this.people.length,
      waveActive: this.waveActive,
    };
  }

  getSurfaceAt(i: number): number {
    return surfaceLevel(this.water, i);
  }

  // Max water depth in cells surrounding a building footprint (buildings block
  // water inside their own cells, so we sample the adjacent ring).
  private maxDepthAroundBuilding(b: Building): number {
    const cx0 = Math.max(0, Math.floor(b.minX / 2 + 40) - 1);
    const cx1 = Math.min(GRID_COLS - 1, Math.ceil(b.maxX / 2 + 40) + 1);
    const cz0 = Math.max(0, Math.floor(b.minZ / 2 + GRID_ROWS / 2) - 1);
    const cz1 = Math.min(GRID_ROWS - 1, Math.ceil(b.maxZ / 2 + GRID_ROWS / 2) + 1);
    let max = 0;
    for (let cz = cz0; cz <= cz1; cz++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const d = this.water.depth[cz * GRID_COLS + cx];
        if (d > max) max = d;
      }
    }
    return max;
  }

  getElevationAt(wx: number, wz: number): number {
    return sampleElevation(this.elevation, wx, wz);
  }

  isLand(i: number): boolean {
    return !this.isOcean[i];
  }
}
