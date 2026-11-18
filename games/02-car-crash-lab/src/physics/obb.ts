import { V2, v2 } from './vec';

// Oriented bounding box in the XZ plane (rotation = yaw around the Y axis).
export interface OBB {
  center: V2;
  half: V2; // local half extents: x = half-length, z = half-width
  angle: number;
}

export interface CollisionResult {
  hit: boolean;
  normal: V2; // unit normal pointing from body B toward body A (A = the first arg)
  depth: number; // penetration depth (m)
  point: V2; // approximate contact point (m)
}

function localAxes(angle: number): V2[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v2(c, s), v2(-s, c)];
}

export function corners(o: OBB): V2[] {
  const [ax, az] = localAxes(o.angle);
  const out: V2[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      out.push(
        v2(
          o.center.x + sx * o.half.x * ax.x + sz * o.half.z * az.x,
          o.center.z + sx * o.half.x * ax.z + sz * o.half.z * az.z,
        ),
      );
    }
  }
  return out;
}

function pointInOBB(p: V2, o: OBB): boolean {
  const c = Math.cos(-o.angle);
  const s = Math.sin(-o.angle);
  const dx = p.x - o.center.x;
  const dz = p.z - o.center.z;
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.abs(lx) <= o.half.x + 1e-6 && Math.abs(lz) <= o.half.z + 1e-6;
}

// Separating-Axis-Theorem collision between two 2D oriented boxes.
export function collideOBB(a: OBB, b: OBB): CollisionResult {
  const axesA = localAxes(a.angle);
  const axesB = localAxes(b.angle);
  const allAxes = [axesA[0], axesA[1], axesB[0], axesB[1]];
  const cornersA = corners(a);
  const cornersB = corners(b);

  let minOverlap = Infinity;
  let bestAxis = v2(1, 0);

  for (const axis of allAxes) {
    let aMin = Infinity;
    let aMax = -Infinity;
    let bMin = Infinity;
    let bMax = -Infinity;
    for (const p of cornersA) {
      const d = p.x * axis.x + p.z * axis.z;
      if (d < aMin) aMin = d;
      if (d > aMax) aMax = d;
    }
    for (const p of cornersB) {
      const d = p.x * axis.x + p.z * axis.z;
      if (d < bMin) bMin = d;
      if (d > bMax) bMax = d;
    }
    const overlap = Math.min(aMax, bMax) - Math.max(aMin, bMin);
    if (overlap <= 0) {
      return { hit: false, normal: v2(0, 0), depth: 0, point: v2(0, 0) };
    }
    if (overlap < minOverlap) {
      minOverlap = overlap;
      bestAxis = axis;
    }
  }

  // Orient the normal so it points from B toward A.
  const dBA = v2(a.center.x - b.center.x, a.center.z - b.center.z);
  let n = bestAxis;
  if (n.x * dBA.x + n.z * dBA.z < 0) {
    n = v2(-n.x, -n.z);
  }

  // Approximate the contact point from the penetrating corners.
  let sx = 0;
  let sz = 0;
  let count = 0;
  for (const p of cornersA) {
    if (pointInOBB(p, b)) {
      sx += p.x;
      sz += p.z;
      count++;
    }
  }
  for (const p of cornersB) {
    if (pointInOBB(p, a)) {
      sx += p.x;
      sz += p.z;
      count++;
    }
  }

  let point: V2;
  if (count > 0) {
    point = v2(sx / count, sz / count);
  } else {
    let bestD = Infinity;
    point = v2(0, 0);
    for (const pa of cornersA) {
      for (const pb of cornersB) {
        const dx = pa.x - pb.x;
        const dz = pa.z - pb.z;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          point = v2((pa.x + pb.x) / 2, (pa.z + pb.z) / 2);
        }
      }
    }
  }

  return { hit: true, normal: n, depth: minOverlap, point };
}
