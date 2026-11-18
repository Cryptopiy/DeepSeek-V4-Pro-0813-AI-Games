export type ObstacleKind = 'concrete-wall' | 'heavy-barrier' | 'light-barrier';

export type Phase = 'idle' | 'running' | 'paused' | 'settled';

export type DamageZone = 'front' | 'rear' | 'left' | 'right';

export interface CrashConfig {
  speedKmh: number;
  massKg: number;
  angleDeg: number;
  obstacle: ObstacleKind;
}

export interface ZoneDamage {
  front: number;
  rear: number;
  left: number;
  right: number;
}

export interface ResultData {
  id: number;
  speedInitialKmh: number;
  speedImpactKmh: number;
  massKg: number;
  angleDeg: number;
  obstacle: ObstacleKind;
  impactForceN: number;
  damagePct: number;
  severity: string;
  impactZone: DamageZone;
  finalX: number;
  finalZ: number;
  finalYawDeg: number;
  keBeforeJ: number;
  keAfterJ: number;
  zoneDamage: ZoneDamage;
}

export interface DebrisParticle {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotX: number;
  rotZ: number;
  angV: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface Spark {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

export interface SkidMark {
  x: number;
  z: number;
  angle: number;
  length: number;
  width: number;
  alpha: number;
}
