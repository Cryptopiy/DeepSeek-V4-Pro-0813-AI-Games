// The human-controlled character when on foot.

import * as THREE from "three";
import { PLAYER_RADIUS, PLAYER_WALK_SPEED, PLAYER_ACCEL } from "../config";
import { createCharacter } from "../models";
import { clamp, lerp, damp, wrapAngle } from "../math";
import type { Vehicle } from "./Vehicle";

export class Player {
  readonly group: THREE.Group;
  readonly radius = PLAYER_RADIUS;
  position = new THREE.Vector3();
  heading = 0;
  velocity = new THREE.Vector3();
  inVehicle: Vehicle | null = null;

  constructor(x: number, z: number) {
    this.position.set(x, 0, z);
    this.group = createCharacter(0x28b6f6, true);
    this.sync();
  }

  sync() {
    this.group.position.set(this.position.x, 0, this.position.z);
    this.group.rotation.y = this.heading;
  }

  // Integrate movement toward the desired direction and return the tentative position.
  step(dt: number, moveX: number, moveZ: number): { x: number; z: number } {
    const len = Math.hypot(moveX, moveZ);
    let tx = 0;
    let tz = 0;
    if (len > 0.001) {
      tx = moveX / len;
      tz = moveZ / len;
    }

    const targetVx = tx * PLAYER_WALK_SPEED;
    const targetVz = tz * PLAYER_WALK_SPEED;
    const f = damp(PLAYER_ACCEL / PLAYER_WALK_SPEED, dt);
    this.velocity.x = lerp(this.velocity.x, targetVx, f);
    this.velocity.z = lerp(this.velocity.z, targetVz, f);

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    if (this.velocity.lengthSq() > 0.05) {
      this.heading = Math.atan2(this.velocity.x, this.velocity.z);
    }
    this.sync();
    return { x: this.position.x, z: this.position.z };
  }

  setPosition(x: number, z: number) {
    this.position.set(x, 0, z);
    this.sync();
  }

  snapToGround() {
    this.position.y = 0;
  }

  // Try to find a valid spot next to a vehicle when exiting.
  computeExitSpot(vehicle: Vehicle, side: number): { x: number; z: number } {
    const offX = Math.cos(vehicle.heading) * side * (vehicle.halfX + this.radius + 0.25);
    const offZ = -Math.sin(vehicle.heading) * side * (vehicle.halfX + this.radius + 0.25);
    return { x: vehicle.position.x + offX, z: vehicle.position.z + offZ };
  }

  get isDriving(): boolean {
    return this.inVehicle !== null;
  }
}
