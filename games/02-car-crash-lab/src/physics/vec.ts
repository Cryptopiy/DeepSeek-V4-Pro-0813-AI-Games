// 2D vector helpers operating in the XZ ground plane.

export interface V2 {
  x: number;
  z: number;
}

export const v2 = (x = 0, z = 0): V2 => ({ x, z });

export const add = (a: V2, b: V2): V2 => v2(a.x + b.x, a.z + b.z);
export const sub = (a: V2, b: V2): V2 => v2(a.x - b.x, a.z - b.z);
export const scale = (a: V2, s: number): V2 => v2(a.x * s, a.z * s);
export const dot = (a: V2, b: V2): number => a.x * b.x + a.z * b.z;
export const cross = (a: V2, b: V2): number => a.x * b.z - a.z * b.x;
export const len = (a: V2): number => Math.hypot(a.x, a.z);
export const perp = (a: V2): V2 => v2(-a.z, a.x);
export const norm = (a: V2): V2 => {
  const l = len(a);
  return l > 1e-9 ? v2(a.x / l, a.z / l) : v2();
};

export const clamp = (x: number, a: number, b: number): number =>
  Math.max(a, Math.min(b, x));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// Rotate a vector around the Y axis by `angle` radians (XZ plane rotation).
export const rotate = (a: V2, angle: number): V2 => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return v2(a.x * c - a.z * s, a.x * s + a.z * c);
};
