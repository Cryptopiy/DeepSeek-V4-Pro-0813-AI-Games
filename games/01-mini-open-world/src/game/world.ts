// Procedural world generation: ground, roads, sidewalks, buildings, obstacles,
// parked cars, and a sidewalk graph used by pedestrian AI.

import * as THREE from "three";
import type { AABB } from "./types";
import {
  ROADS_X,
  ROADS_Z,
  ROAD_HALF,
  SIDEWALK_WIDTH,
  WORLD_MIN,
  WORLD_MAX,
  COLORS,
  MISSION,
  POLICE,
} from "./config";
import { createBuilding, createTree, createLampPost, createRestrictedZone } from "./models";
import { pick, randomRange } from "./math";

export interface ParkedCarSpec {
  x: number;
  z: number;
  heading: number;
  color: number;
  mission: boolean;
}

export interface SidewalkNode {
  x: number;
  z: number;
  neighbors: number[];
}

export interface SidewalkGraph {
  nodes: SidewalkNode[];
}

export interface WorldData {
  group: THREE.Group;
  aabbs: AABB[];
  graph: SidewalkGraph;
  parkedCars: ParkedCarSpec[];
  policeStationAabb: AABB;
}

const SIDEWALK_OUTER = ROAD_HALF + SIDEWALK_WIDTH; // 7

function roadPlane(width: number, height: number, y: number): THREE.Mesh {
  const g = new THREE.PlaneGeometry(width, height);
  const m = new THREE.MeshStandardMaterial({ color: COLORS.road, roughness: 0.95 });
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return mesh;
}

function sidewalkPlane(width: number, height: number, y: number): THREE.Mesh {
  const g = new THREE.PlaneGeometry(width, height);
  const m = new THREE.MeshStandardMaterial({ color: COLORS.sidewalk, roughness: 0.9 });
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildWorld(): WorldData {
  const group = new THREE.Group();
  const aabbs: AABB[] = [];
  const worldSpan = WORLD_MAX - WORLD_MIN;

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(worldSpan + 40, worldSpan + 40),
    new THREE.MeshStandardMaterial({ color: COLORS.grass, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  ground.receiveShadow = true;
  group.add(ground);

  // Roads (horizontal along X, and vertical along Z)
  const roadSpan = WORLD_MAX - WORLD_MIN;
  for (const z of ROADS_Z) {
    const r = roadPlane(roadSpan, ROAD_HALF * 2, 0.01);
    r.position.set(0, 0, z);
    group.add(r);
    // sidewalks (north + south)
    const n = sidewalkPlane(roadSpan, SIDEWALK_WIDTH, 0.02);
    n.position.set(0, 0, z + ROAD_HALF + SIDEWALK_WIDTH / 2);
    group.add(n);
    const s = sidewalkPlane(roadSpan, SIDEWALK_WIDTH, 0.02);
    s.position.set(0, 0, z - ROAD_HALF - SIDEWALK_WIDTH / 2);
    group.add(s);
    // dashed center line
    addDashedLine(group, -WORLD_MAX, z, WORLD_MAX, z, 0.02);
  }
  for (const x of ROADS_X) {
    const r = roadPlane(ROAD_HALF * 2, roadSpan, 0.01);
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, 0, 0);
    group.add(r);
    const e = sidewalkPlane(SIDEWALK_WIDTH, roadSpan, 0.02);
    e.position.set(x + ROAD_HALF + SIDEWALK_WIDTH / 2, 0, 0);
    group.add(e);
    const w = sidewalkPlane(SIDEWALK_WIDTH, roadSpan, 0.02);
    w.position.set(x - ROAD_HALF - SIDEWALK_WIDTH / 2, 0, 0);
    group.add(w);
    addDashedLine(group, x, -WORLD_MAX, x, WORLD_MAX, 0.02);
  }

  // Buildings: one block per grid cell between consecutive roads.
  const xs = [...ROADS_X];
  const zs = [...ROADS_Z];
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < zs.length - 1; bj++) {
      // Reserve the southwest block for the police station.
      if (bi === 0 && bj === 0) continue;
      const minX = xs[bi] + SIDEWALK_OUTER;
      const maxX = xs[bi + 1] - SIDEWALK_OUTER;
      const minZ = zs[bj] + SIDEWALK_OUTER;
      const maxZ = zs[bj + 1] - SIDEWALK_OUTER;
      buildBlock(group, aabbs, minX, maxX, minZ, maxZ);
    }
  }

  // Police station (overwrite the southwest block with a dedicated station).
  const stationAabb = buildPoliceStation(group, aabbs);

  // Obstacles: trees along sidewalks + lamp posts at intersections.
  addTreesAndLamps(group, aabbs);

  // Restricted zone visual in front of the police station.
  const rz = POLICE.restricted;
  const zone = createRestrictedZone(rz.maxX - rz.minX, rz.maxZ - rz.minZ);
  zone.position.set((rz.minX + rz.maxX) / 2, 0, (rz.minZ + rz.maxZ) / 2);
  group.add(zone);

  // Parked cars (specs consumed by the Game).
  const parkedCars: ParkedCarSpec[] = buildParkedCars();

  const graph = buildSidewalkGraph();

  return { group, aabbs, graph, parkedCars, policeStationAabb: stationAabb };
}

function addDashedLine(group: THREE.Group, x0: number, z0: number, x1: number, z1: number, y: number) {
  const horizontal = z0 === z1;
  const length = horizontal ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const dashLen = 1.4;
  const gap = 1.6;
  const mat = new THREE.MeshBasicMaterial({ color: COLORS.roadLine, transparent: true, opacity: 0.7 });
  const geo = new THREE.PlaneGeometry(horizontal ? dashLen : 0.18, horizontal ? 0.18 : dashLen);
  let t = dashLen / 2;
  while (t < length) {
    const dash = new THREE.Mesh(geo, mat);
    dash.rotation.x = -Math.PI / 2;
    if (horizontal) {
      dash.position.set(x0 + t, y, z0);
    } else {
      dash.position.set(x0, y, z0 + t);
    }
    group.add(dash);
    t += dashLen + gap;
  }
}

function buildBlock(group: THREE.Group, aabbs: AABB[], minX: number, maxX: number, minZ: number, maxZ: number) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  if (w < 6 || d < 6) return;

  const cols = 2;
  const rows = 2;
  const lotW = w / cols;
  const lotD = d / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (Math.random() < 0.28) continue; // leave some open space
      const cx = minX + lotW * (i + 0.5);
      const cz = minZ + lotD * (j + 0.5);
      const bw = lotW * randomRange(0.55, 0.82);
      const bd = lotD * randomRange(0.55, 0.82);
      const bh = randomRange(8, 24);
      const color = pick(COLORS.building);
      const mesh = createBuilding(bw, bd, bh, color);
      mesh.position.set(cx, 0, cz);
      group.add(mesh);
      aabbs.push({
        minX: cx - bw / 2,
        maxX: cx + bw / 2,
        minZ: cz - bd / 2,
        maxZ: cz + bd / 2,
      });
    }
  }
}

function buildPoliceStation(group: THREE.Group, aabbs: AABB[]): AABB {
  const sx = POLICE.station.x;
  const sz = POLICE.station.z;
  const bw = 24;
  const bd = 22;
  const bh = 10;
  const mesh = createBuilding(bw, bd, bh, 0x263238);
  mesh.position.set(sx, 0, sz);
  group.add(mesh);

  // Police sign
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(6, 2.2, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.5 }),
  );
  sign.position.set(sx, 7, sz + bd / 2 + 0.2);
  group.add(sign);

  const aabb: AABB = { minX: sx - bw / 2, maxX: sx + bw / 2, minZ: sz - bd / 2, maxZ: sz + bd / 2 };
  aabbs.push(aabb);
  return aabb;
}

function addTreesAndLamps(group: THREE.Group, aabbs: AABB[]) {
  // Trees along the sidewalk outer edges of horizontal roads
  for (const z of ROADS_Z) {
    for (const x of [-90, -65, -40, -15, 10, 35, 60, 85]) {
      if (Math.random() < 0.5) {
        const tree = createTree();
        tree.position.set(x, 0, z + SIDEWALK_OUTER + 0.6);
        group.add(tree);
        aabbs.push({ minX: x - 0.35, maxX: x + 0.35, minZ: z + SIDEWALK_OUTER + 0.25, maxZ: z + SIDEWALK_OUTER + 0.95 });
      }
    }
  }
  // Lamp posts at intersections
  for (const x of ROADS_X) {
    for (const z of ROADS_Z) {
      for (const [dx, dz] of [[-6.4, -6.4], [6.4, 6.4], [-6.4, 6.4], [6.4, -6.4]] as const) {
        const lamp = createLampPost();
        lamp.position.set(x + dx, 0, z + dz);
        group.add(lamp);
        aabbs.push({ minX: x + dx - 0.25, maxX: x + dx + 0.25, minZ: z + dz - 0.25, maxZ: z + dz + 0.25 });
      }
    }
  }
}

function buildParkedCars(): ParkedCarSpec[] {
  const east = Math.PI / 2;
  const west = -Math.PI / 2;
  const cars: ParkedCarSpec[] = [
    // Road z = -25 (horizontal), parked on the road edges
    { x: -60, z: -22.2, heading: east, color: 0x90a4ae, mission: false },
    { x: -38, z: -27.8, heading: west, color: 0x8d6e63, mission: false },
    { x: -6, z: -22.2, heading: east, color: 0x42a5f5, mission: false },
    { x: MISSION.car.x, z: MISSION.car.z, heading: MISSION.car.heading, color: 0xf5c518, mission: true },
    { x: 55, z: -27.8, heading: west, color: 0x66bb6a, mission: false },
    // Road x = 25 (vertical)
    { x: 22.2, z: 40, heading: Math.PI, color: 0xef5350, mission: false },
    { x: 27.8, z: 60, heading: 0, color: 0xab47bc, mission: false },
    // Road z = 25
    { x: -52, z: 22.2, heading: east, color: 0x26a69a, mission: false },
    { x: 12, z: 27.8, heading: west, color: 0xffffff, mission: false },
    // Road x = -25
    { x: -22.2, z: -52, heading: Math.PI, color: 0xff7043, mission: false },
    { x: -27.8, z: 8, heading: 0, color: 0x42a5f5, mission: false },
    // Road z = -75
    { x: 42, z: -72.2, heading: east, color: 0x8d6e63, mission: false },
    { x: 66, z: -77.8, heading: west, color: 0x90a4ae, mission: false },
  ];
  return cars;
}

function buildSidewalkGraph(): SidewalkGraph {
  const nodes: SidewalkNode[] = [];
  const index = new Map<string, number>();

  const addNode = (x: number, z: number): number => {
    const key = `${x.toFixed(2)},${z.toFixed(2)}`;
    const existing = index.get(key);
    if (existing !== undefined) return existing;
    index.set(key, nodes.length);
    nodes.push({ x, z, neighbors: [] });
    return nodes.length - 1;
  };

  const connect = (a: number, b: number) => {
    if (a !== b) {
      if (!nodes[a].neighbors.includes(b)) nodes[a].neighbors.push(b);
      if (!nodes[b].neighbors.includes(a)) nodes[b].neighbors.push(a);
    }
  };

  // Corner nodes at every intersection (4 corners each).
  for (const x of ROADS_X) {
    for (const z of ROADS_Z) {
      addNode(x + SIDEWALK_OUTER, z + SIDEWALK_OUTER);
      addNode(x + SIDEWALK_OUTER, z - SIDEWALK_OUTER);
      addNode(x - SIDEWALK_OUTER, z + SIDEWALK_OUTER);
      addNode(x - SIDEWALK_OUTER, z - SIDEWALK_OUTER);
    }
  }

  // Horizontal sidewalk edges: connect adjacent corners along each road line.
  for (const z of ROADS_Z) {
    for (let i = 0; i < ROADS_X.length - 1; i++) {
      const x0 = ROADS_X[i];
      const x1 = ROADS_X[i + 1];
      connect(addNode(x0 + SIDEWALK_OUTER, z + SIDEWALK_OUTER), addNode(x1 + SIDEWALK_OUTER, z + SIDEWALK_OUTER));
      connect(addNode(x0 + SIDEWALK_OUTER, z - SIDEWALK_OUTER), addNode(x1 + SIDEWALK_OUTER, z - SIDEWALK_OUTER));
      connect(addNode(x0 - SIDEWALK_OUTER, z + SIDEWALK_OUTER), addNode(x1 - SIDEWALK_OUTER, z + SIDEWALK_OUTER));
      connect(addNode(x0 - SIDEWALK_OUTER, z - SIDEWALK_OUTER), addNode(x1 - SIDEWALK_OUTER, z - SIDEWALK_OUTER));
    }
  }

  // Vertical sidewalk edges.
  for (const x of ROADS_X) {
    for (let i = 0; i < ROADS_Z.length - 1; i++) {
      const z0 = ROADS_Z[i];
      const z1 = ROADS_Z[i + 1];
      connect(addNode(x + SIDEWALK_OUTER, z0 + SIDEWALK_OUTER), addNode(x + SIDEWALK_OUTER, z1 + SIDEWALK_OUTER));
      connect(addNode(x + SIDEWALK_OUTER, z0 - SIDEWALK_OUTER), addNode(x + SIDEWALK_OUTER, z1 - SIDEWALK_OUTER));
      connect(addNode(x - SIDEWALK_OUTER, z0 + SIDEWALK_OUTER), addNode(x - SIDEWALK_OUTER, z1 + SIDEWALK_OUTER));
      connect(addNode(x - SIDEWALK_OUTER, z0 - SIDEWALK_OUTER), addNode(x - SIDEWALK_OUTER, z1 - SIDEWALK_OUTER));
    }
  }

  // Corner cycles at each intersection so pedestrians can cross roads / turn corners.
  for (const x of ROADS_X) {
    for (const z of ROADS_Z) {
      const ne = addNode(x + SIDEWALK_OUTER, z + SIDEWALK_OUTER);
      const se = addNode(x + SIDEWALK_OUTER, z - SIDEWALK_OUTER);
      const sw = addNode(x - SIDEWALK_OUTER, z - SIDEWALK_OUTER);
      const nw = addNode(x - SIDEWALK_OUTER, z + SIDEWALK_OUTER);
      connect(ne, se);
      connect(se, sw);
      connect(sw, nw);
      connect(nw, ne);
      // Diagonal crossings to allow crossing through the intersection.
      connect(ne, sw);
      connect(nw, se);
    }
  }

  return { nodes };
}
