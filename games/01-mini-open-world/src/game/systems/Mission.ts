// The single mission: walk to a pickup, enter a marked car, drive to a drop-off.

import * as THREE from "three";
import { MISSION, MISSION_PICKUP_RADIUS, MISSION_DROPOFF_RADIUS } from "../config";
import { createMarker } from "../models";
import { dist2D } from "../math";

export type MissionStage = 0 | 1 | 2 | 3;

export class Mission {
  stage: MissionStage = 0;
  complete = false;

  readonly pickupMarker: THREE.Group;
  readonly dropoffMarker: THREE.Group;
  readonly carHighlight: THREE.Group;

  constructor() {
    this.pickupMarker = createMarker(0x66e05b);
    this.pickupMarker.position.set(MISSION.pickup.x, 0, MISSION.pickup.z);

    this.dropoffMarker = createMarker(0xffa726);
    this.dropoffMarker.position.set(MISSION.dropoff.x, 0, MISSION.dropoff.z);

    this.carHighlight = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(CAR_RING_RADIUS, 0.14, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xf5c518 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    this.carHighlight.add(ring);
    this.carHighlight.position.set(MISSION.car.x, 0, MISSION.car.z);

    this.refreshVisibility();
  }

  get objective(): string {
    switch (this.stage) {
      case 0:
        return "Walk to the pickup marker";
      case 1:
        return "Enter the marked car (E)";
      case 2:
        return "Drive to the drop-off point";
      case 3:
        return "Mission complete! Press R to replay";
    }
  }

  // Called every frame with the player position / state.
  update(px: number, pz: number, onFoot: boolean, inMissionCar: boolean) {
    if (this.complete) return;

    if (this.stage === 0) {
      if (onFoot && dist2D(px, pz, MISSION.pickup.x, MISSION.pickup.z) < MISSION_PICKUP_RADIUS) {
        this.stage = 1;
      }
    } else if (this.stage === 1) {
      if (!onFoot && inMissionCar) {
        this.stage = 2;
      }
    } else if (this.stage === 2) {
      if (!onFoot && dist2D(px, pz, MISSION.dropoff.x, MISSION.dropoff.z) < MISSION_DROPOFF_RADIUS) {
        this.stage = 3;
        this.complete = true;
      }
    }

    this.refreshVisibility();
  }

  onEnterVehicle(isMissionCar: boolean) {
    if (this.stage === 1 && isMissionCar) {
      this.stage = 2;
    }
    this.refreshVisibility();
  }

  restart() {
    this.stage = 0;
    this.complete = false;
    this.refreshVisibility();
  }

  animate(t: number) {
    const pulse = 1 + Math.sin(t * 3) * 0.12;
    this.pickupMarker.scale.setScalar(pulse);
    this.dropoffMarker.scale.setScalar(pulse);
    this.pickupMarker.rotation.y += 0.02;
    this.dropoffMarker.rotation.y += 0.02;
  }

  private refreshVisibility() {
    this.pickupMarker.visible = this.stage === 0;
    this.carHighlight.visible = this.stage === 0 || this.stage === 1;
    this.dropoffMarker.visible = this.stage === 2;
  }
}

const CAR_RING_RADIUS = 3.0;
