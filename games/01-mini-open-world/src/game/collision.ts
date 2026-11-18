// 3D collision detection & resolution in the XZ plane (y is up).
// Uses circles for characters and oriented boxes (OBB) for vehicles,
// with axis-aligned boxes (AABB) for buildings/obstacles.

import type { AABB, OBB, CircleObstacle } from "./types";
import { clamp } from "./math";

export interface CollisionResult {
  hit: boolean;
  nx: number; // penetration normal (world space)
  nz: number;
  depth: number;
}

function clampPoint(x: number, min: number, max: number): number {
  return clamp(x, min, max);
}

// ---- Circle vs AABB ----

export function circleVsAABB(cx: number, cz: number, r: number, b: AABB): CollisionResult {
  const closestX = clampPoint(cx, b.minX, b.maxX);
  const closestZ = clampPoint(cz, b.minZ, b.maxZ);
  const dx = cx - closestX;
  const dz = cz - closestZ;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return { hit: false, nx: 0, nz: 0, depth: 0 };
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    return { hit: true, nx: dx / d, nz: dz / d, depth: r - d };
  }
  // Circle center inside the AABB: push out along smallest axis.
  const pushLeft = cx - b.minX + r;
  const pushRight = b.maxX - cx + r;
  const pushTop = cz - b.minZ + r;
  const pushBottom = b.maxZ - cz + r;
  const min = Math.min(pushLeft, pushRight, pushTop, pushBottom);
  if (min === pushLeft) return { hit: true, nx: -1, nz: 0, depth: pushLeft };
  if (min === pushRight) return { hit: true, nx: 1, nz: 0, depth: pushRight };
  if (min === pushTop) return { hit: true, nx: 0, nz: -1, depth: pushTop };
  return { hit: true, nx: 0, nz: 1, depth: pushBottom };
}

// ---- Circle vs OBB ----

export function circleVsOBB(cx: number, cz: number, r: number, o: OBB): CollisionResult {
  const rx = Math.cos(o.angle);
  const rz = -Math.sin(o.angle); // local right axis
  const fx = Math.sin(o.angle);
  const fz = Math.cos(o.angle); // local forward axis

  const dx = cx - o.x;
  const dz = cz - o.z;
  const lx = dx * rx + dz * rz;
  const lz = dx * fx + dz * fz;

  const closestX = clampPoint(lx, -o.halfX, o.halfX);
  const closestZ = clampPoint(lz, -o.halfZ, o.halfZ);
  const ddx = lx - closestX;
  const ddz = lz - closestZ;
  const d2 = ddx * ddx + ddz * ddz;

  if (d2 >= r * r) return { hit: false, nx: 0, nz: 0, depth: 0 };

  let nlx: number;
  let nlz: number;
  let depth: number;

  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    nlx = ddx / d;
    nlz = ddz / d;
    depth = r - d;
  } else {
    // Circle center inside the OBB.
    const pushX = o.halfX - Math.abs(lx);
    const pushZ = o.halfZ - Math.abs(lz);
    if (pushX < pushZ) {
      nlx = lx >= 0 ? 1 : -1;
      nlz = 0;
      depth = pushX + r;
    } else {
      nlx = 0;
      nlz = lz >= 0 ? 1 : -1;
      depth = pushZ + r;
    }
  }

  const nx = rx * nlx + fx * nlz;
  const nz = rz * nlx + fz * nlz;
  return { hit: true, nx, nz, depth };
}

// ---- OBB vs OBB (SAT) ----
// Returns MTV to move `a` out of `b`.

interface Axis {
  x: number;
  z: number;
}

function projectOBB(o: OBB, ax: number, az: number): [number, number] {
  const center = o.x * ax + o.z * az;
  const rx = Math.cos(o.angle);
  const rz = -Math.sin(o.angle);
  const fx = Math.sin(o.angle);
  const fz = Math.cos(o.angle);
  const radius = o.halfX * Math.abs(rx * ax + rz * az) + o.halfZ * Math.abs(fx * ax + fz * az);
  return [center - radius, center + radius];
}

export function obbVsObb(a: OBB, b: OBB): CollisionResult {
  const aAxes: Axis[] = [
    { x: Math.cos(a.angle), z: -Math.sin(a.angle) }, // right
    { x: Math.sin(a.angle), z: Math.cos(a.angle) }, // forward
  ];
  const bAxes: Axis[] = [
    { x: Math.cos(b.angle), z: -Math.sin(b.angle) },
    { x: Math.sin(b.angle), z: Math.cos(b.angle) },
  ];
  const axes = [...aAxes, ...bAxes];

  let bestOverlap = Infinity;
  let bestAxis: Axis = axes[0];

  for (const axis of axes) {
    const pa = projectOBB(a, axis.x, axis.z);
    const pb = projectOBB(b, axis.x, axis.z);
    const overlap = Math.min(pa[1], pb[1]) - Math.max(pa[0], pb[0]);
    if (overlap <= 0) return { hit: false, nx: 0, nz: 0, depth: 0 };
    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      bestAxis = axis;
    }
  }

  // Ensure the normal points from b toward a.
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  let nx = bestAxis.x;
  let nz = bestAxis.z;
  if (dx * nx + dz * nz < 0) {
    nx = -nx;
    nz = -nz;
  }
  return { hit: true, nx, nz, depth: bestOverlap };
}

export function aabbToObb(b: AABB): OBB {
  return {
    x: (b.minX + b.maxX) / 2,
    z: (b.minZ + b.maxZ) / 2,
    halfX: (b.maxX - b.minX) / 2,
    halfZ: (b.maxZ - b.minZ) / 2,
    angle: 0,
  };
}

export function obbVsAABB(a: OBB, b: AABB): CollisionResult {
  return obbVsObb(a, aabbToObb(b));
}

// ---- Resolution helpers ----

// Resolve a circle against static AABBs and a set of OBBs. Mutates position by sliding.
export function resolveCircle(
  cx: number,
  cz: number,
  r: number,
  aabbs: readonly AABB[],
  obbs: readonly OBB[],
  iterations = 3,
): { x: number; z: number; collided: boolean } {
  let x = cx;
  let z = cz;
  let collided = false;
  for (let iter = 0; iter < iterations; iter++) {
    for (const b of aabbs) {
      const res = circleVsAABB(x, z, r, b);
      if (res.hit) {
        x += res.nx * res.depth;
        z += res.nz * res.depth;
        collided = true;
      }
    }
    for (const o of obbs) {
      const res = circleVsOBB(x, z, r, o);
      if (res.hit) {
        x += res.nx * res.depth;
        z += res.nz * res.depth;
        collided = true;
      }
    }
  }
  return { x, z, collided };
}

// Resolve an OBB against static AABBs and other OBBs. Mutates position (slide).
export function resolveOBB(
  obb: OBB,
  aabbs: readonly AABB[],
  otherObbs: readonly OBB[],
  iterations = 3,
): { collided: boolean; hitNormX: number; hitNormZ: number } {
  let collided = false;
  let hitNormX = 0;
  let hitNormZ = 0;
  for (let iter = 0; iter < iterations; iter++) {
    for (const b of aabbs) {
      const res = obbVsAABB(obb, b);
      if (res.hit) {
        obb.x += res.nx * res.depth;
        obb.z += res.nz * res.depth;
        collided = true;
        hitNormX = res.nx;
        hitNormZ = res.nz;
      }
    }
    for (const o of otherObbs) {
      const res = obbVsObb(obb, o);
      if (res.hit) {
        obb.x += res.nx * res.depth;
        obb.z += res.nz * res.depth;
        collided = true;
        hitNormX = res.nx;
        hitNormZ = res.nz;
      }
    }
  }
  return { collided, hitNormX, hitNormZ };
}

// Build OBBs for a set of circles used as obstacles for vehicles.
export function circlesAsObstacles(circles: readonly CircleObstacle[]): OBB[] {
  return circles.map((c) => ({
    x: c.x,
    z: c.z,
    halfX: c.radius,
    halfZ: c.radius,
    angle: 0,
  }));
}

// Resolve a vehicle OBB against circle obstacles (pedestrians / player on foot).
export function resolveOBBVsCircles(obb: OBB, circles: readonly CircleObstacle[], iterations = 2): boolean {
  let collided = false;
  for (let iter = 0; iter < iterations; iter++) {
    for (const c of circles) {
      const res = circleVsOBB(c.x, c.z, c.radius, obb);
      if (res.hit) {
        // Push the vehicle out opposite the normal.
        obb.x -= res.nx * res.depth;
        obb.z -= res.nz * res.depth;
        collided = true;
      }
    }
  }
  return collided;
}
