// Third-person follow camera with smooth motion and optional mouse orbit.

import * as THREE from "three";
import { CAMERA_FOOT_DIST, CAMERA_FOOT_HEIGHT, CAMERA_CAR_DIST, CAMERA_CAR_HEIGHT } from "../config";
import { clamp, damp, lerp } from "../math";

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;

  yaw = 0;
  private pitch = -0.35;
  private distance = CAMERA_FOOT_DIST;
  private height = CAMERA_FOOT_HEIGHT;

  private manualYaw = 0;
  private manualPitch = 0;
  dragging = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 400);
    this.camera.position.set(0, 10, 20);
  }

  onResize(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  startDrag() {
    this.dragging = true;
  }

  endDrag() {
    this.dragging = false;
  }

  drag(dx: number, dy: number) {
    this.manualYaw -= dx * 0.005;
    this.manualPitch = clamp(this.manualPitch - dy * 0.005, -0.9, 1.4);
  }

  update(
    dt: number,
    target: THREE.Vector3,
    targetYaw: number,
    driving: boolean,
  ) {
    const targetDist = driving ? CAMERA_CAR_DIST : CAMERA_FOOT_DIST;
    const targetHeight = driving ? CAMERA_CAR_HEIGHT : CAMERA_FOOT_HEIGHT;
    const targetPitch = driving ? -0.2 : -0.35;

    this.distance = lerp(this.distance, targetDist, damp(4, dt));
    this.height = lerp(this.height, targetHeight, damp(4, dt));
    this.yaw = lerpAngle(this.yaw, targetYaw, damp(6, dt));
    this.pitch = lerp(this.pitch, targetPitch, damp(4, dt));

    // Manual orbit decays slowly when not dragging.
    if (!this.dragging) {
      this.manualYaw = lerp(this.manualYaw, 0, damp(0.6, dt));
    }

    const yaw = this.yaw + this.manualYaw;
    const pitch = this.pitch + this.manualPitch;

    const cosP = Math.cos(pitch);
    const offset = new THREE.Vector3(
      Math.sin(yaw) * cosP * this.distance,
      Math.sin(pitch) * this.distance + this.height,
      Math.cos(yaw) * cosP * this.distance,
    );

    const desired = new THREE.Vector3(target.x, target.y + 1.2, target.z).add(offset);
    this.camera.position.lerp(desired, damp(12, dt));

    this.camera.lookAt(target.x, target.y + 1.4, target.z);
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
