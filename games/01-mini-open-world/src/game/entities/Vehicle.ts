// A drivable/AI vehicle with simple arcade physics: acceleration, drag,
// speed-dependent steering, and a mesh group.

import * as THREE from "three";
import type { OBB, VehicleControls } from "../types";
import {
  CAR_HALF_WIDTH,
  CAR_HALF_LENGTH,
  CAR_MAX_SPEED,
  CAR_REVERSE_MAX,
  CAR_ACCEL,
  CAR_BRAKE,
  CAR_DRAG,
  CAR_STEER_RATE,
} from "../config";
import { clamp, lerp, damp, forwardX, forwardZ } from "../math";
import { createCar, type CarModel } from "../models";

export class Vehicle {
  readonly model: CarModel;
  readonly halfX = CAR_HALF_WIDTH;
  readonly halfZ = CAR_HALF_LENGTH;

  position = new THREE.Vector3();
  heading: number;
  speed = 0;
  steer = 0;
  color: number;
  isPolice: boolean;

  // Tunable physics parameters (defaults are the player car values).
  maxSpeed = CAR_MAX_SPEED;
  reverseMax = CAR_REVERSE_MAX;
  accel = CAR_ACCEL;
  brake = CAR_BRAKE;
  drag = CAR_DRAG;
  steerRate = CAR_STEER_RATE;

  constructor(x: number, z: number, heading: number, color: number, police = false) {
    this.position.set(x, 0, z);
    this.heading = heading;
    this.color = color;
    this.isPolice = police;
    this.model = createCar(color, police);
    this.sync();
  }

  sync() {
    this.model.group.position.set(this.position.x, 0, this.position.z);
    this.model.group.rotation.y = this.heading;
    // Animate steering wheels slightly.
    for (const w of this.model.wheels) {
      w.rotation.z = Math.PI / 2 + this.steer * 0.35;
    }
  }

  get obb(): OBB {
    return { x: this.position.x, z: this.position.z, halfX: this.halfX, halfZ: this.halfZ, angle: this.heading };
  }

  update(dt: number, controls: VehicleControls) {
    // Acceleration / braking
    let accel = controls.throttle * this.accel;
    if (controls.brake) {
      if (Math.abs(this.speed) > 0.5) accel -= Math.sign(this.speed) * this.brake;
      else this.speed = 0;
    }
    this.speed += accel * dt;

    // Drag / friction
    this.speed -= this.speed * this.drag * dt;

    // Clamp
    if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
    if (this.speed < -this.reverseMax) this.speed = -this.reverseMax;

    // Deadzone so the car settles when there is no input.
    if (controls.throttle === 0 && !controls.brake && Math.abs(this.speed) < 0.4) {
      this.speed = 0;
    }

    // Steering (smoothed, and turning scaled by speed).
    const target = controls.steer * this.steerRate;
    this.steer = lerp(this.steer, target, damp(8, dt));

    const turnScale = clamp(this.speed / 6, -1, 1);
    this.heading += this.steer * turnScale * dt;
    this.heading = Math.atan2(Math.sin(this.heading), Math.cos(this.heading));

    // Integrate position.
    this.position.x += forwardX(this.heading) * this.speed * dt;
    this.position.z += forwardZ(this.heading) * this.speed * dt;

    this.sync();
  }

  get speedKmh(): number {
    return Math.abs(this.speed) * 3.6;
  }
}
