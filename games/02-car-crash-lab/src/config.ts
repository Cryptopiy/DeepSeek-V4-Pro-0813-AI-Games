// Core constants for the simplified crash physics model.
// Units: metres (m), kilograms (kg), seconds (s), Newtons (N), Joules (J).

export const CAR_HALF = { x: 2.15, z: 0.85 }; // half-length, half-width of the vehicle
export const CAR_RESTITUTION = 0.2; // not used directly; per-obstacle restitution drives collisions
export const CAR_FRICTION = 0.6; // contact friction coefficient (Coulomb)
export const CAR_RIGIDITY = 0.4; // relative "crushability" of the car (lower = softer, absorbs more)

export const START_DISTANCE = 28; // metres from obstacle centre at launch
export const IMPACT_DURATION = 0.08; // assumed real-world impact duration (s) for force estimate
export const E0_DAMAGE = 140000; // reference crush energy (J) that maps to ~63% damage
export const FIXED_DT = 1 / 240; // fixed physics timestep (s)
export const MAX_SIM_TIME = 9; // force-settle after this many seconds

export const SPEED_MIN = 10;
export const SPEED_MAX = 200;
export const MASS_MIN = 700;
export const MASS_MAX = 3000;
export const ANGLE_MIN = -60;
export const ANGLE_MAX = 60;

export const KMH_TO_MS = 1 / 3.6;
