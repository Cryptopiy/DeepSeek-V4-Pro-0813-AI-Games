import { Vehicle, Person, Building } from './types';
import { bilinearDepth, bilinearVelocity, sampleElevation } from './terrain';
import type { WaterState } from './water';
const WATER_DENSITY = 1000;
const DRAG_COEF = 1.1;

function circleVsAABB(
  px: number,
  pz: number,
  r: number,
  b: Building,
): { hit: boolean; nx: number; nz: number; depth: number } {
  const cx = Math.max(b.minX, Math.min(px, b.maxX));
  const cz = Math.max(b.minZ, Math.min(pz, b.maxZ));
  const dx = px - cx;
  const dz = pz - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 > r * r) return { hit: false, nx: 0, nz: 0, depth: 0 };
  let dist = Math.sqrt(d2);
  let nx: number;
  let nz: number;
  if (dist < 1e-6) {
    // center inside box: push out along smallest axis
    const left = px - b.minX;
    const right = b.maxX - px;
    const top = pz - b.minZ;
    const bottom = b.maxZ - pz;
    const m = Math.min(left, right, top, bottom);
    if (m === left) { nx = -1; nz = 0; }
    else if (m === right) { nx = 1; nz = 0; }
    else if (m === top) { nx = 0; nz = -1; }
    else { nx = 0; nz = 1; }
    dist = 0;
  } else {
    nx = dx / dist;
    nz = dz / dist;
  }
  return { hit: true, nx, nz, depth: r - dist };
}

export function stepVehicles(
  vehicles: Vehicle[],
  water: WaterState,
  buildings: Building[],
  dt: number,
): void {
  for (const veh of vehicles) {
    const depth = bilinearDepth(water.depth, veh.x, veh.z);
    const flow = bilinearVelocity(water.u, water.v, veh.x, veh.z);

    // Force model: hydrodynamic drag proportional to submerged cross-section
    // and relative velocity, plus buoyancy reducing ground friction.
    const relU = flow.u - veh.vx;
    const relV = flow.v - veh.vz;
    const relSpeed = Math.hypot(relU, relV);
    // Frontal area approx = width * min(depth, height)
    const submergedH = Math.min(depth, veh.h);
    const area = veh.w * submergedH;

    let ax = 0;
    let az = 0;
    if (depth > 0.05 && area > 0) {
      const force = 0.5 * WATER_DENSITY * DRAG_COEF * area * relSpeed * relSpeed;
      const fx = relSpeed > 1e-6 ? (relU / relSpeed) * force : 0;
      const fz = relSpeed > 1e-6 ? (relV / relSpeed) * force : 0;
      ax = fx / veh.mass;
      az = fz / veh.mass;
    }

    veh.vx += ax * dt;
    veh.vz += az * dt;

    // Buoyancy reduces ground friction; in deep water the car drifts.
    const afloat = depth > veh.h * 0.55;
    const friction = afloat ? 0.15 : 1.8;
    const fric = Math.exp(-friction * dt);
    veh.vx *= fric;
    veh.vz *= fric;

    veh.x += veh.vx * dt;
    veh.z += veh.vz * dt;

    // Rotate toward velocity when moving.
    const sp = Math.hypot(veh.vx, veh.vz);
    if (sp > 0.35) {
      const targetHeading = Math.atan2(veh.vz, veh.vx);
      let d = targetHeading - veh.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const maxTurn = 3.0 * dt;
      veh.heading += Math.max(-maxTurn, Math.min(maxTurn, d));
    }

    // Collision with buildings.
    for (const b of buildings) {
      const res = circleVsAABB(veh.x, veh.z, 1.6, b);
      if (res.hit) {
        veh.x += res.nx * res.depth;
        veh.z += res.nz * res.depth;
        const vn = veh.vx * res.nx + veh.vz * res.nz;
        if (vn < 0) {
          veh.vx -= vn * res.nx;
          veh.vz -= vn * res.nz;
          veh.vx *= 0.4;
          veh.vz *= 0.4;
        }
      }
    }

    // Keep within world bounds.
    veh.x = Math.max(-60, Math.min(172, veh.x));
    veh.z = Math.max(-120, Math.min(120, veh.z));

    veh.afloat = afloat;
    veh.displaced =
      Math.hypot(veh.x - veh.startX, veh.z - veh.startZ) > 2.0 || afloat;
  }
}

export function stepPeople(
  people: Person[],
  water: WaterState,
  dt: number,
  safeElevation: number,
): void {
  for (const p of people) {
    const depth = bilinearDepth(water.depth, p.x, p.z);
    const elev = sampleElevation(water.elevation, p.x, p.z);

    if (depth > 0.55) {
      // Caught by water: swept with the flow.
      const flow = bilinearVelocity(water.u, water.v, p.x, p.z);
      p.vx = p.vx * 0.9 + flow.u * 0.1;
      p.vz = p.vz * 0.9 + flow.v * 0.1;
      p.swept = true;
    } else {
      // Head toward higher ground (target).
      const dx = p.targetX - p.x;
      const dz = p.targetZ - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 3) {
        const speed = 2.2;
        p.vx = (dx / dist) * speed;
        p.vz = (dz / dist) * speed;
      } else {
        p.vx = 0;
        p.vz = 0;
      }
    }

    if (elev >= safeElevation && depth < 0.4) {
      p.safe = true;
      p.vx = 0;
      p.vz = 0;
    }

    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.x = Math.max(-40, Math.min(172, p.x));
    p.z = Math.max(-120, Math.min(120, p.z));
  }
}
