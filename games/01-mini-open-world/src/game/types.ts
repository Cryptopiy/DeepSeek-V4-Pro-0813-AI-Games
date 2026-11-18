// Core shared types for the simulation.

export type GameMode = "ON FOOT" | "DRIVING";

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

// An oriented bounding box in the XZ plane (y is up).
// halfX is extent along the local "right" axis, halfZ along the local "forward" axis.
export interface OBB {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  angle: number; // rotation around Y, forward = (sin, 0, cos)
}

export interface CircleObstacle {
  x: number;
  z: number;
  radius: number;
}

export interface HudState {
  mode: GameMode;
  speed: number; // km/h when driving, else 0
  objective: string;
  wanted: number; // 0..2
  wantedFlash: boolean;
  hint: string;
  missionComplete: boolean;
  missionStage: number;
}

export interface VehicleControls {
  throttle: number; // 1 forward, -1 reverse
  brake: boolean;
  steer: number; // -1 left, 1 right
}
