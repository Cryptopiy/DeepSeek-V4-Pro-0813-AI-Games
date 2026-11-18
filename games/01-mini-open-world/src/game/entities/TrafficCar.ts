// Autonomous traffic vehicle that follows a closed waypoint loop.

import { Vehicle } from "./Vehicle";
import { TRAFFIC_SPEED, TRAFFIC_ACCEL, TRAFFIC_STEER_RATE } from "../config";
import { angleDiff, clamp, dist2D } from "../math";

export interface Waypoint {
  x: number;
  z: number;
}

export class TrafficCar {
  readonly vehicle: Vehicle;
  private loop: Waypoint[];
  private index = 0;

  constructor(x: number, z: number, heading: number, color: number, loop: Waypoint[]) {
    this.vehicle = new Vehicle(x, z, heading, color, false);
    this.vehicle.maxSpeed = TRAFFIC_SPEED;
    this.vehicle.accel = TRAFFIC_ACCEL;
    this.vehicle.steerRate = TRAFFIC_STEER_RATE;
    this.loop = loop;
    this.index = nearestWaypoint(x, z, loop);
  }

  update(dt: number, blockedAhead: boolean) {
    const wp = this.loop[this.index];
    const desired = Math.atan2(wp.x - this.vehicle.position.x, wp.z - this.vehicle.position.z);
    const err = angleDiff(this.vehicle.heading, desired);

    if (dist2D(this.vehicle.position.x, this.vehicle.position.z, wp.x, wp.z) < 3.5) {
      this.index = (this.index + 1) % this.loop.length;
    }

    const steer = clamp(err * 2.4, -1, 1);
    const targetSpeed = blockedAhead ? 0 : TRAFFIC_SPEED;
    let throttle = clamp((targetSpeed - this.vehicle.speed) * 0.6, -1, 1);

    // Slow down through sharp turns.
    if (Math.abs(err) > 1.1) {
      throttle = Math.min(throttle, 0.35);
    }

    this.vehicle.update(dt, { throttle, brake: false, steer });
  }
}

function nearestWaypoint(x: number, z: number, loop: Waypoint[]): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < loop.length; i++) {
    const d = dist2D(x, z, loop[i].x, loop[i].z);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
