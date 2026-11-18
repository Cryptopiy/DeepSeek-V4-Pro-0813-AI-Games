// Wanted/pursuit system. Triggers on crimes, spawns/activates police cars,
// tracks an escape timer, and clears the wanted state when the player escapes.

import * as THREE from "three";
import { PoliceCar } from "../entities/PoliceCar";
import type { Vehicle } from "../entities/Vehicle";
import { POLICE, WANTED_LEVELS, WANTED_ESCAPE_TIME, ESCAPE_DISTANCE } from "../config";

export class PoliceSystem {
  readonly cars: PoliceCar[] = [];
  wanted = 0;
  wantedFlash = false;

  private crimeTimer = 0;
  private escapeTimer = 0;
  private flashTimer = 0;

  constructor(parent: THREE.Object3D) {
    for (const p of POLICE.park) {
      const car = new PoliceCar(p.x, p.z, p.heading);
      parent.add(car.vehicle.model.group);
      this.cars.push(car);
    }
  }

  reportCrime(level = 1) {
    this.wanted = Math.min(Math.max(this.wanted, level), WANTED_LEVELS);
    this.crimeTimer = 0;
    this.escapeTimer = 0;
    this.refreshActivation();
  }

  isRestricted(x: number, z: number): boolean {
    const r = POLICE.restricted;
    return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
  }

  private refreshActivation() {
    this.cars.forEach((car, i) => {
      car.active = i < this.wanted;
    });
  }

  update(dt: number, playerPos: { x: number; z: number }, blockedAhead: (v: Vehicle) => boolean) {
    if (this.wanted > 0) {
      this.crimeTimer += dt;

      // Distance-based escape: if far from every active cop, accumulate escape time.
      let nearest = Infinity;
      for (const car of this.cars) {
        if (car.active) nearest = Math.min(nearest, car.distanceTo(playerPos.x, playerPos.z));
      }
      if (nearest > ESCAPE_DISTANCE) {
        this.escapeTimer += dt;
      } else {
        this.escapeTimer = 0;
      }

      const escaped = this.escapeTimer > WANTED_ESCAPE_TIME || this.crimeTimer > WANTED_ESCAPE_TIME * 3;
      if (escaped) {
        this.wanted = 0;
        this.crimeTimer = 0;
        this.escapeTimer = 0;
        this.refreshActivation();
      }
    }

    // Flash indicator while wanted.
    this.flashTimer += dt;
    this.wantedFlash = this.wanted > 0 && Math.floor(this.flashTimer * 2) % 2 === 0;

    // Update each police car.
    this.cars.forEach((car) => {
      const target = this.wanted > 0 ? playerPos : null;
      car.update(dt, target, blockedAhead(car.vehicle));
    });
  }
}
