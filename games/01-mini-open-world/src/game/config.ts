// Shared constants for the world and gameplay tuning.

export const ROADS_X = [-75, -25, 25, 75] as const;
export const ROADS_Z = [-75, -25, 25, 75] as const;

export const ROAD_HALF = 4;
export const SIDEWALK_WIDTH = 3;
export const SIDEWALK_OFFSET = ROAD_HALF + SIDEWALK_WIDTH; // distance from road center to outer sidewalk edge

export const WORLD_MIN = -100;
export const WORLD_MAX = 100;

// Player on foot
export const PLAYER_RADIUS = 0.5;
export const PLAYER_WALK_SPEED = 6.2;
export const PLAYER_ACCEL = 40;

// Vehicle physics
export const CAR_HALF_WIDTH = 0.95;
export const CAR_HALF_LENGTH = 2.1;
export const CAR_MAX_SPEED = 26;
export const CAR_REVERSE_MAX = 8.5;
export const CAR_ACCEL = 16;
export const CAR_BRAKE = 30;
export const CAR_DRAG = 0.5;
export const CAR_STEER_RATE = 2.0;

// Traffic
export const TRAFFIC_SPEED = 13;
export const TRAFFIC_ACCEL = 10;
export const TRAFFIC_STEER_RATE = 1.8;

// Police
export const POLICE_SPEED = 20;
export const POLICE_ACCEL = 18;
export const POLICE_STEER_RATE = 2.4;
export const WANTED_LEVELS = 2; // max wanted level
export const WANTED_ESCAPE_TIME = 18; // seconds without a crime to clear wanted
export const ESCAPE_DISTANCE = 26; // distance from police to count as escaping

// Interaction
export const ENTER_RADIUS = 2.7; // distance to show enter hint
export const EXIT_MIN_SPEED = 6; // can exit while moving slower than this

// Mission
export const MISSION_PICKUP_RADIUS = 3.2;
export const MISSION_DROPOFF_RADIUS = 4.0;

// Camera
export const CAMERA_FOOT_DIST = 8.5;
export const CAMERA_FOOT_HEIGHT = 4.2;
export const CAMERA_CAR_DIST = 11.5;
export const CAMERA_CAR_HEIGHT = 4.8;

// Colors
export const COLORS = {
  grass: 0x6aa84f,
  road: 0x2f3238,
  roadLine: 0xe8e8e8,
  sidewalk: 0x9a9da4,
  curb: 0x7c7f86,
  building: [0x8d6e63, 0xb0bec5, 0x90a4ae, 0xa1887f, 0x78909c, 0xbcaaa4, 0x9e9e9e, 0xcfd8dc],
  buildingRoof: 0x4e5a63,
  player: 0x28b6f6,
  missionCar: 0xf5c518,
  police: 0x0f1b3d,
  policeAccent: 0xeef2f7,
  treeTrunk: 0x6d4c41,
  treeLeaf: 0x3e7d32,
  lamp: 0x37474f,
} as const;

export const PEDESTRIAN_COLORS = [
  0xe57373, 0x81c784, 0xffb74d, 0x9575cd, 0x4fc3f7, 0xf06292, 0xffd54f, 0xaed581,
] as const;

export const TRAFFIC_COLORS = [
  0xef5350, 0x42a5f5, 0x66bb6a, 0xffffff, 0xab47bc, 0x26a69a, 0xff7043, 0x8d6e63,
] as const;

export const MISSION = {
  spawn: { x: 6, z: -19.5 },
  pickup: { x: 32, z: -18 },
  car: { x: 34, z: -22.2, heading: Math.PI / 2 },
  dropoff: { x: -75, z: -50 },
} as const;

export const POLICE = {
  station: { x: -50, z: -50 },
  restricted: { minX: -62, maxX: -38, minZ: -79, maxZ: -71 },
  park: [
    { x: -50, z: -72, heading: Math.PI / 2 },
    { x: -56, z: -72, heading: Math.PI / 2 },
  ],
} as const;
