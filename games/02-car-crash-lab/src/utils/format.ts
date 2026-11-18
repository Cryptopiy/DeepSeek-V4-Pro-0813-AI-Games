export const round = (n: number, d = 1): number => Number(n.toFixed(d));
export const fmt = (n: number, d = 1): string => n.toFixed(d);
export const kN = (n: number): string => `${(n / 1000).toFixed(0)} kN`;
export const kJ = (n: number): string => `${(n / 1000).toFixed(0)} kJ`;
export const deg = (n: number): string => `${n.toFixed(1)}°`;

export function normalizeDeg(d: number): number {
  let a = d % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}
