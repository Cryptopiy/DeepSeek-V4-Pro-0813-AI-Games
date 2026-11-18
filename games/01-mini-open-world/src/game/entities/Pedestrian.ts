// Pedestrian NPC with a simple state machine: walking along a sidewalk graph,
// waiting, fleeing from danger, and briefly knocked down when hit.

import * as THREE from "three";
import type { SidewalkGraph } from "../world";
import { createCharacter } from "../models";
import { clamp, randomRange, damp, lerp } from "../math";

export type PedState = "walking" | "waiting" | "fleeing" | "down";

const WALK_SPEED = 2.6;
const FLEE_SPEED = 4.8;
const REACH_RADIUS = 0.6;

export class Pedestrian {
  readonly group: THREE.Group;
  readonly radius = 0.38;
  position = new THREE.Vector3();
  heading = 0;
  state: PedState = "walking";
  color: number;

  private graph: SidewalkGraph;
  private currentNode: number;
  private path: number[] = [];
  private waitTimer = 0;
  private downTimer = 0;
  private stuckTime = 0;
  private fleeX = 0;
  private fleeZ = 0;
  private fleeTimer = 0;
  private speed: number;

  constructor(x: number, z: number, graph: SidewalkGraph, color: number) {
    this.graph = graph;
    this.color = color;
    this.position.set(x, 0, z);
    this.speed = WALK_SPEED * randomRange(0.8, 1.25);
    this.currentNode = nearestNode(x, z, graph);
    this.group = createCharacter(color, false);
    this.pickDestination();
    this.sync();
  }

  private pickDestination() {
    const target = Math.floor(Math.random() * this.graph.nodes.length);
    if (target === this.currentNode) {
      this.path = [];
      return;
    }
    this.path = bfs(this.graph, this.currentNode, target);
    this.state = "walking";
    this.stuckTime = 0;
  }

  startFlee(x: number, z: number, duration = 3) {
    // Flee away from the given danger point.
    const dx = this.position.x - x;
    const dz = this.position.z - z;
    const len = Math.hypot(dx, dz) || 1;
    this.fleeX = dx / len;
    this.fleeZ = dz / len;
    this.fleeTimer = duration;
    this.state = "fleeing";
    this.path = [];
  }

  knockDown(duration = 4) {
    this.state = "down";
    this.downTimer = duration;
    this.path = [];
  }

  // Advance the AI and integrate position. Returns the tentative new position.
  step(dt: number): { x: number; z: number; moving: boolean } {
    let vx = 0;
    let vz = 0;
    let moving = false;

    switch (this.state) {
      case "walking": {
        if (this.path.length === 0) {
          this.state = "waiting";
          this.waitTimer = randomRange(1.2, 4.5);
          break;
        }
        const next = this.graph.nodes[this.path[0]];
        const dx = next.x - this.position.x;
        const dz = next.z - this.position.z;
        const d = Math.hypot(dx, dz);
        if (d < REACH_RADIUS) {
          this.currentNode = this.path.shift() as number;
          if (this.path.length === 0) {
            this.state = "waiting";
            this.waitTimer = randomRange(1.2, 4.5);
          }
          break;
        }
        vx = (dx / d) * this.speed;
        vz = (dz / d) * this.speed;
        moving = true;
        break;
      }
      case "waiting": {
        this.waitTimer -= dt;
        if (this.waitTimer <= 0) this.pickDestination();
        break;
      }
      case "fleeing": {
        this.fleeTimer -= dt;
        vx = this.fleeX * FLEE_SPEED;
        vz = this.fleeZ * FLEE_SPEED;
        moving = true;
        if (this.fleeTimer <= 0) {
          this.state = "walking";
          this.currentNode = nearestNode(this.position.x, this.position.z, this.graph);
          this.pickDestination();
        }
        break;
      }
      case "down": {
        this.downTimer -= dt;
        if (this.downTimer <= 0) {
          this.state = "walking";
          this.currentNode = nearestNode(this.position.x, this.position.z, this.graph);
          this.pickDestination();
        }
        break;
      }
    }

    this.position.x += vx * dt;
    this.position.z += vz * dt;
    if (moving) {
      this.heading = Math.atan2(vx, vz);
    }

    // Tilt the character when down.
    const targetTilt = this.state === "down" ? -Math.PI / 2 : 0;
    this.group.rotation.x = lerp(this.group.rotation.x, targetTilt, damp(10, dt));

    this.sync();
    return { x: this.position.x, z: this.position.z, moving };
  }

  setPosition(x: number, z: number) {
    this.position.set(x, 0, z);
    this.sync();
  }

  // Called by the game when the pedestrian was pushed by a collision while trying to move.
  onBlocked(dt: number) {
    if (this.state === "walking" || this.state === "fleeing") {
      this.stuckTime += dt;
      if (this.stuckTime > 1.1) {
        if (this.state === "walking") {
          this.currentNode = nearestNode(this.position.x, this.position.z, this.graph);
          this.pickDestination();
        } else {
          // While fleeing, adjust direction sideways.
          const tmp = this.fleeX;
          this.fleeX = -this.fleeZ;
          this.fleeZ = tmp;
          this.fleeTimer = Math.max(this.fleeTimer, 0.8);
        }
        this.stuckTime = 0;
      }
    }
  }

  private sync() {
    this.group.position.set(this.position.x, 0, this.position.z);
    this.group.rotation.y = this.heading;
  }
}

function nearestNode(x: number, z: number, graph: SidewalkGraph): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < graph.nodes.length; i++) {
    const n = graph.nodes[i];
    const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function bfs(graph: SidewalkGraph, start: number, target: number): number[] {
  const prev = new Array<number>(graph.nodes.length).fill(-1);
  const visited = new Array<boolean>(graph.nodes.length).fill(false);
  const queue: number[] = [start];
  visited[start] = true;
  while (queue.length) {
    const cur = queue.shift() as number;
    if (cur === target) break;
    for (const nb of graph.nodes[cur].neighbors) {
      if (!visited[nb]) {
        visited[nb] = true;
        prev[nb] = cur;
        queue.push(nb);
      }
    }
  }
  if (!visited[target]) return [];
  const path: number[] = [];
  let cur = target;
  while (cur !== start) {
    path.unshift(cur);
    cur = prev[cur];
    if (cur === -1) return [];
  }
  return path;
}
