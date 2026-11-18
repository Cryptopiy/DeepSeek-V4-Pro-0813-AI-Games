// Small math helpers used across the simulation.

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Exponential smoothing factor for a given delta time and half-life.
export function damp(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

// Wrap an angle to [-PI, PI].
export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Shortest signed angle from `from` to `to` in [-PI, PI].
export function angleDiff(from: number, to: number): number {
  return wrapAngle(to - from);
}

export function dist2D(x1: number, z1: number, x2: number, z2: number): number {
  const dx = x1 - x2;
  const dz = z1 - z2;
  return Math.sqrt(dx * dx + dz * dz);
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Direction vectors from a yaw angle (forward = (sin, cos)).
export function forwardX(angle: number): number {
  return Math.sin(angle);
}

export function forwardZ(angle: number): number {
  return Math.cos(angle);
}

export function rightX(angle: number): number {
  return Math.cos(angle);
}

export function rightZ(angle: number): number {
  return -Math.sin(angle);
}
