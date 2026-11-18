// Police vehicle that activates to pursue the player, then returns to its post.

import { Vehicle } from "./Vehicle";
import { POLICE_SPEED, POLICE_ACCEL, POLICE_STEER_RATE, COLORS } from "../config";
import { angleDiff, clamp, dist2D } from "../math";

export class PoliceCar {
  readonly vehicle: Vehicle;
  active = false;
  private homeX: number;
  private homeZ: number;
  private homeHeading: number;

  constructor(x: number, z: number, heading: number) {
    this.homeX = x;
    this.homeZ = z;
    this.homeHeading = heading;
    this.vehicle = new Vehicle(x, z, heading, COLORS.police, true);
    this.vehicle.maxSpeed = POLICE_SPEED;
    this.vehicle.accel = POLICE_ACCEL;
    this.vehicle.steerRate = POLICE_STEER_RATE;
  }

  activate() {
    this.active = true;
  }

  deactivate() {
    this.active = false;
  }

  update(dt: number, target: { x: number; z: number } | null, blockedAhead: boolean) {
    let steer = 0;
    let throttle = 0;
    let brake = false;

    if (this.active && target) {
      const v = this.vehicle;
      const dx = target.x - v.position.x;
      const dz = target.z - v.position.z;
      const d = Math.hypot(dx, dz);
      const desired = Math.atan2(dx, dz);
      const err = angleDiff(v.heading, desired);
      steer = clamp(err * 2.8, -1, 1);

      const targetSpeed = blockedAhead ? 0 : d < 4 ? 4 : POLICE_SPEED;
      throttle = clamp((targetSpeed - v.speed) * 0.8, -1, 1);
      if (d < 3.5 && Math.abs(v.speed) > 1) brake = true;
    } else if (!this.active) {
      // Return to post.
      const v = this.vehicle;
      const dx = this.homeX - v.position.x;
      const dz = this.homeZ - v.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 2) {
        const err = angleDiff(v.heading, this.homeHeading);
        steer = clamp(err * 3, -1, 1);
        throttle = clamp(-v.speed * 0.6, -1, 1);
        if (Math.abs(err) < 0.05 && Math.abs(v.speed) < 0.3) {
          v.speed = 0;
        }
      } else {
        const desired = Math.atan2(dx, dz);
        const err = angleDiff(v.heading, desired);
        steer = clamp(err * 2.8, -1, 1);
        const targetSpeed = blockedAhead ? 0 : Math.min(10, d);
        throttle = clamp((targetSpeed - v.speed) * 0.8, -1, 1);
      }
    }

    this.vehicle.update(dt, { throttle, brake, steer });
  }

  distanceTo(x: number, z: number): number {
    return dist2D(this.vehicle.position.x, this.vehicle.position.z, x, z);
  }
}
