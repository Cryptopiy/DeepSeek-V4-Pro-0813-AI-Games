import {
  GRID_COLS,
  GRID_ROWS,
  SEA_COLS,
} from './types';

export interface WaterState {
  elevation: Float32Array;
  depth: Float32Array;
  u: Float32Array; // flow velocity x (m/s, approximate)
  v: Float32Array; // flow velocity z (m/s, approximate)
  isOcean: Uint8Array;
  isBuilding: Uint8Array;
}

export function createWaterState(
  elevation: Float32Array,
  isOcean: Uint8Array,
  isBuilding: Uint8Array,
): WaterState {
  const n = GRID_COLS * GRID_ROWS;
  const depth = new Float32Array(n);
  const u = new Float32Array(n);
  const v = new Float32Array(n);
  return { elevation, depth, u, v, isOcean, isBuilding };
}

// Water surface level (elevation + depth).
function surfaceOf(state: WaterState, i: number): number {
  return state.elevation[i] + state.depth[i];
}

// Ocean water level during the event: rises to waveHeight, holds, recedes.
export function oceanLevel(t: number, waveHeight: number, waveActive: boolean): number {
  if (!waveActive) return 0;
  const rise = 4.0;
  const hold = 3.0;
  const fall = 9.0;
  if (t < rise) return waveHeight * smoothstep(t / rise);
  if (t < rise + hold) return waveHeight;
  const tf = (t - rise - hold) / fall;
  if (tf < 1) return waveHeight * (1 - smoothstep(tf));
  return 0;
}

function smoothstep(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

export function stepWater(state: WaterState, dt: number, waveHeight: number, waveActive: boolean, eventTime: number): void {
  const n = GRID_COLS * GRID_ROWS;
  const { elevation, depth, isOcean, isBuilding } = state;
  const level = oceanLevel(eventTime, waveHeight, waveActive);

  // Set ocean boundary water level.
  for (let cz = 0; cz < GRID_ROWS; cz++) {
    for (let cx = 0; cx < GRID_COLS; cx++) {
      const i = cz * GRID_COLS + cx;
      if (isOcean[i]) {
        depth[i] = Math.max(0, level - elevation[i]);
      }
    }
  }

  // Double-buffered relaxation of the water surface.
  const newDepth = depth.slice();
  const flowRate = 0.42;
  const maxOut = 0.45;
  const idx = (cx: number, cz: number) => cz * GRID_COLS + cx;
  const cellSurface = (i: number) => (isOcean[i] ? level : surfaceOf(state, i));

  for (let cz = 0; cz < GRID_ROWS; cz++) {
    for (let cx = 0; cx < GRID_COLS; cx++) {
      const i = cz * GRID_COLS + cx;
      if (isBuilding[i]) continue;
      const si = cellSurface(i);
      const isReservoir = isOcean[i] === 1;
      // Per-cell outflow budget prevents a cell from donating more than it holds.
      let budget = isReservoir ? Infinity : depth[i];

      // neighbor indices, computed inline to avoid allocation
      let nbi: number;
      let sNb: number;
      let diff: number;
      let move: number;
      let nSurf: number;

      if (cx + 1 < GRID_COLS) {
        nbi = i + 1;
        if (!isBuilding[nbi]) {
          sNb = cellSurface(nbi);
          diff = si - sNb;
          if (diff > 0) {
            move = diff * flowRate;
            if (isReservoir) {
              if (!isOcean[nbi]) {
                nSurf = elevation[nbi] + newDepth[nbi];
                move = Math.min(move, Math.max(0, level - nSurf), 2.0);
                newDepth[nbi] += move;
              }
            } else if (isOcean[nbi]) {
              move = Math.min(move, budget);
              newDepth[i] -= move;
              budget -= move;
            } else {
              nSurf = elevation[nbi] + newDepth[nbi];
              move = Math.min(move, depth[i] * maxOut, budget, Math.max(0, si - nSurf));
              newDepth[i] -= move;
              newDepth[nbi] += move;
              budget -= move;
            }
          }
        }
      }

      if (cx - 1 >= 0) {
        nbi = i - 1;
        if (!isBuilding[nbi]) {
          sNb = cellSurface(nbi);
          diff = si - sNb;
          if (diff > 0) {
            move = diff * flowRate;
            if (isReservoir) {
              if (!isOcean[nbi]) {
                nSurf = elevation[nbi] + newDepth[nbi];
                move = Math.min(move, Math.max(0, level - nSurf), 2.0);
                newDepth[nbi] += move;
              }
            } else if (isOcean[nbi]) {
              move = Math.min(move, budget);
              newDepth[i] -= move;
              budget -= move;
            } else {
              nSurf = elevation[nbi] + newDepth[nbi];
              move = Math.min(move, depth[i] * maxOut, budget, Math.max(0, si - nSurf));
              newDepth[i] -= move;
              newDepth[nbi] += move;
              budget -= move;
            }
          }
        }
      }

      if (cz + 1 < GRID_ROWS) {
        nbi = i + GRID_COLS;
        if (!isBuilding[nbi]) {
          sNb = cellSurface(nbi);
          diff = si - sNb;
          if (diff > 0) {
            move = diff * flowRate;
            if (isReservoir) {
              if (!isOcean[nbi]) {
                nSurf = elevation[nbi] + newDepth[nbi];
                move = Math.min(move, Math.max(0, level - nSurf), 2.0);
                newDepth[nbi] += move;
              }
            } else if (isOcean[nbi]) {
              move = Math.min(move, budget);
              newDepth[i] -= move;
              budget -= move;
            } else {
              nSurf = elevation[nbi] + newDepth[nbi];
              move = Math.min(move, depth[i] * maxOut, budget, Math.max(0, si - nSurf));
              newDepth[i] -= move;
              newDepth[nbi] += move;
              budget -= move;
            }
          }
        }
      }

      if (cz - 1 >= 0) {
        nbi = i - GRID_COLS;
        if (!isBuilding[nbi]) {
          sNb = cellSurface(nbi);
          diff = si - sNb;
          if (diff > 0) {
            move = diff * flowRate;
            if (isReservoir) {
              if (!isOcean[nbi]) {
                nSurf = elevation[nbi] + newDepth[nbi];
                move = Math.min(move, Math.max(0, level - nSurf), 2.0);
                newDepth[nbi] += move;
              }
            } else if (isOcean[nbi]) {
              move = Math.min(move, budget);
              newDepth[i] -= move;
              budget -= move;
            } else {
              nSurf = elevation[nbi] + newDepth[nbi];
              move = Math.min(move, depth[i] * maxOut, budget, Math.max(0, si - nSurf));
              newDepth[i] -= move;
              newDepth[nbi] += move;
              budget -= move;
            }
          }
        }
      }
    }
  }

  // Apply and clamp.
  for (let i = 0; i < n; i++) {
    if (isOcean[i]) continue;
    depth[i] = Math.max(0, newDepth[i]);
  }

  // Estimate flow velocity from the surface gradient, with momentum smoothing.
  const damp = Math.exp(-dt * 1.2);
  const k = 6.0;
  const inv2dx = 1 / (2 * 2); // CELL_SIZE = 2
  for (let cz = 1; cz < GRID_ROWS - 1; cz++) {
    for (let cx = 1; cx < GRID_COLS - 1; cx++) {
      const i = idx(cx, cz);
      if (isOcean[i] || isBuilding[i]) continue;
      const sL = isOcean[idx(cx - 1, cz)] ? level : surfaceOf(state, idx(cx - 1, cz));
      const sR = isOcean[idx(cx + 1, cz)] ? level : surfaceOf(state, idx(cx + 1, cz));
      const sB = isOcean[idx(cx, cz - 1)] ? level : surfaceOf(state, idx(cx, cz - 1));
      const sF = isOcean[idx(cx, cz + 1)] ? level : surfaceOf(state, idx(cx, cz + 1));
      const gx = (sR - sL) * inv2dx;
      const gz = (sF - sB) * inv2dx;
      state.u[i] = (state.u[i] * damp - gx * k * (1 - damp));
      state.v[i] = (state.v[i] * damp - gz * k * (1 - damp));
      // guard against numerical blowup
      if (!Number.isFinite(state.u[i])) state.u[i] = 0;
      if (!Number.isFinite(state.v[i])) state.v[i] = 0;
      const sp = Math.hypot(state.u[i], state.v[i]);
      const maxSp = 8;
      if (sp > maxSp) {
        state.u[i] *= maxSp / sp;
        state.v[i] *= maxSp / sp;
      }
    }
  }

  // Clear flow on ocean/building cells so objects are not pushed by boundary.
  for (let cz = 0; cz < GRID_ROWS; cz++) {
    for (let cx = 0; cx < SEA_COLS + 1; cx++) {
      const i = cz * GRID_COLS + cx;
      state.u[i] = 0;
      state.v[i] = 0;
    }
  }
}

export function surfaceLevel(state: WaterState, i: number): number {
  return state.elevation[i] + state.depth[i];
}
