// Top-level game orchestrator: owns the scene, entities, and systems, runs the
// fixed-timestep simulation loop, and publishes HUD state to React.

import * as THREE from "three";
import type { HudState, VehicleControls, OBB, CircleObstacle } from "./types";
import { Input } from "./input";
import { buildWorld, type WorldData } from "./world";
import { Player } from "./entities/Player";
import { Vehicle } from "./entities/Vehicle";
import { Pedestrian } from "./entities/Pedestrian";
import { TrafficCar, type Waypoint } from "./entities/TrafficCar";
import { Mission } from "./systems/Mission";
import { PoliceSystem } from "./systems/Police";
import { CameraController } from "./systems/CameraController";
import { resolveCircle, resolveOBB, resolveOBBVsCircles, obbVsObb, circleVsOBB } from "./collision";
import { clamp, dist2D, forwardX, forwardZ, pick } from "./math";
import {
  MISSION,
  ENTER_RADIUS,
  EXIT_MIN_SPEED,
  ROADS_X,
  ROADS_Z,
  WORLD_MIN,
  WORLD_MAX,
  PEDESTRIAN_COLORS,
  TRAFFIC_COLORS,
} from "./config";

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cameraController: CameraController;
  private input = new Input();
  private world: WorldData;

  private player: Player;
  private enterableCars: Vehicle[] = [];
  private missionVehicle: Vehicle | null = null;
  private traffic: TrafficCar[] = [];
  private pedestrians: Pedestrian[] = [];
  private police: PoliceSystem;
  private mission: Mission;

  private clock = new THREE.Clock();
  private time = 0;
  private rafId = 0;
  private lastHudJson = "";
  private onHud: (h: HudState) => void;
  private disposed = false;

  private container: HTMLElement;

  constructor(container: HTMLElement, onHud: (h: HudState) => void) {
    this.container = container;
    this.onHud = onHud;

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x86b6dc);
    this.scene.fog = new THREE.Fog(0x86b6dc, 90, 260);

    this.cameraController = new CameraController(w / h);

    this.setupLights();
    this.world = buildWorld();
    this.scene.add(this.world.group);

    this.player = new Player(MISSION.spawn.x, MISSION.spawn.z);
    this.scene.add(this.player.group);

    this.setupEnterableCars();
    this.setupTraffic();
    this.setupPedestrians();

    this.police = new PoliceSystem(this.scene);
    this.mission = new Mission();
    this.scene.add(this.mission.pickupMarker);
    this.scene.add(this.mission.dropoffMarker);
    this.scene.add(this.mission.carHighlight);

    this.input.attach();
    this.bindPointer();
    window.addEventListener("resize", this.onResize);

    this.loop();
  }

  private setupLights() {
    const hemi = new THREE.HemisphereLight(0xcfdfff, 0x6a8a5a, 0.95);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(70, 110, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -130;
    sun.shadow.camera.right = 130;
    sun.shadow.camera.top = 130;
    sun.shadow.camera.bottom = -130;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 400;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
  }

  private setupEnterableCars() {
    for (const spec of this.world.parkedCars) {
      const v = new Vehicle(spec.x, spec.z, spec.heading, spec.color, false);
      this.scene.add(v.model.group);
      this.enterableCars.push(v);
      if (spec.mission) this.missionVehicle = v;
    }
  }

  private setupTraffic() {
    const loops = buildTrafficLoops();
    const assignments: { loop: Waypoint[]; color: number }[] = [
      { loop: loops.outer, color: TRAFFIC_COLORS[0] },
      { loop: loops.outer, color: TRAFFIC_COLORS[2] },
      { loop: loops.inner, color: TRAFFIC_COLORS[1] },
      { loop: loops.inner, color: TRAFFIC_COLORS[5] },
      { loop: loops.horiz, color: TRAFFIC_COLORS[4] },
      { loop: loops.vert, color: TRAFFIC_COLORS[6] },
    ];

    assignments.forEach((a, i) => {
      const wp = a.loop[i % a.loop.length];
      const next = a.loop[(i + 1) % a.loop.length];
      const heading = Math.atan2(next.x - wp.x, next.z - wp.z);
      const car = new TrafficCar(wp.x, wp.z, heading, a.color, a.loop);
      this.scene.add(car.vehicle.model.group);
      this.traffic.push(car);
    });
  }

  private setupPedestrians() {
    const count = 16;
    const nodes = this.world.graph.nodes;
    for (let i = 0; i < count; i++) {
      const n = nodes[Math.floor(Math.random() * nodes.length)];
      const ped = new Pedestrian(n.x, n.z, this.world.graph, pick(PEDESTRIAN_COLORS));
      this.scene.add(ped.group);
      this.pedestrians.push(ped);
    }
  }

  private bindPointer() {
    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", (e) => {
      if (e.button === 0) {
        this.cameraController.startDrag();
        el.setPointerCapture(e.pointerId);
      }
    });
    el.addEventListener("pointermove", (e) => {
      if (this.cameraController.dragging) {
        this.cameraController.drag(e.movementX, e.movementY);
      }
    });
    el.addEventListener("pointerup", () => this.cameraController.endDrag());
    el.addEventListener("pointercancel", () => this.cameraController.endDrag());
  }

  private onResize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.cameraController.onResize(w / h);
  };

  private loop = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    this.update(dt);
    this.renderer.render(this.scene, this.cameraController.camera);
  };

  private update(dt: number) {
    const snap = this.input.snapshot();

    if (this.input.consumeRestart()) {
      this.restartMission();
    }

    this.handleEnterExit();

    const playerCar = this.player.inVehicle;
    const enterableObbs = this.enterableCars.map((v) => v.obb);

    // --- Player ---
    if (!playerCar) {
      const camYaw = this.cameraController.yaw;
      const dir = computeMoveDir(snap, camYaw);
      const tentative = this.player.step(dt, dir.x, dir.z);
      const carObbs = [...enterableObbs, ...this.allActiveVehicleObbs()];
      const res = resolveCircle(tentative.x, tentative.z, this.player.radius, this.world.aabbs, carObbs);
      this.player.setPosition(res.x, res.z);
      if (this.police.isRestricted(this.player.position.x, this.player.position.z)) {
        this.police.reportCrime(1);
      }
    } else {
      playerCar.update(dt, buildCarControls(snap));
    }

    // --- Traffic ---
    for (const t of this.traffic) {
      t.update(dt, this.blockedAhead(t.vehicle));
    }

    // --- Police ---
    const playerPos = this.player.inVehicle
      ? { x: this.player.inVehicle.position.x, z: this.player.inVehicle.position.z }
      : { x: this.player.position.x, z: this.player.position.z };
    this.police.update(dt, playerPos, (v) => this.blockedAhead(v));

    // --- Resolve all moving vehicles ---
    const activeVehicles: Vehicle[] = [
      ...this.traffic.map((t) => t.vehicle),
      ...this.police.cars.map((p) => p.vehicle),
    ];
    if (playerCar) activeVehicles.push(playerCar);

    const playerCircle: CircleObstacle | null = playerCar
      ? null
      : { x: this.player.position.x, z: this.player.position.z, radius: this.player.radius };

    for (const v of activeVehicles) {
      const others = [
        ...enterableObbs,
        ...activeVehicles.filter((o) => o !== v).map((o) => o.obb),
      ];
      this.resolveVehicle(v, others, playerCircle);
      this.clampToWorld(v);
    }

    // --- Player car interactions (post resolve) ---
    if (playerCar) {
      this.handleCarHits(playerCar);
      if (this.police.isRestricted(playerCar.position.x, playerCar.position.z)) {
        this.police.reportCrime(1);
      }
    }

    // --- Pedestrians ---
    const allCarObbs = [...enterableObbs, ...activeVehicles.map((v) => v.obb)];
    for (const ped of this.pedestrians) {
      this.maybeFlee(ped);
      const res = ped.step(dt);
      const r = resolveCircle(res.x, res.z, ped.radius, this.world.aabbs, allCarObbs);
      ped.setPosition(r.x, r.z);
      if (r.collided && res.moving) ped.onBlocked(dt);
    }

    // --- Mission / camera / visibility ---
    this.player.group.visible = !playerCar;

    const targetPos = playerCar ? playerCar.position : this.player.position;
    const targetYaw = playerCar ? playerCar.heading : this.player.heading;
    this.cameraController.update(dt, targetPos, targetYaw, !!playerCar);

    this.mission.update(
      playerPos.x,
      playerPos.z,
      !playerCar,
      playerCar === this.missionVehicle,
    );
    this.mission.animate(this.time);

    this.pushHud();
  }

  private handleCarHits(playerCar: Vehicle) {
    // Crashing into a police vehicle always draws attention.
    for (const p of this.police.cars) {
      if (obbVsObb(playerCar.obb, p.vehicle.obb).hit) {
        this.police.reportCrime(2);
      }
    }

    if (Math.abs(playerCar.speed) < 3) return;
    const speed = Math.abs(playerCar.speed);

    for (const ped of this.pedestrians) {
      if (ped.state === "down") continue;
      if (circleVsOBB(ped.position.x, ped.position.z, ped.radius + 0.2, playerCar.obb).hit) {
        ped.knockDown();
        this.police.reportCrime(2);
      }
    }
    for (const t of this.traffic) {
      if (obbVsObb(playerCar.obb, t.vehicle.obb).hit && speed > 5) {
        this.police.reportCrime(1);
      }
    }
  }

  private maybeFlee(ped: Pedestrian) {
    if (ped.state === "down") return;

    let danger: { x: number; z: number } | null = null;

    const car = this.player.inVehicle;
    if (car && Math.abs(car.speed) > 5) {
      const d = dist2D(ped.position.x, ped.position.z, car.position.x, car.position.z);
      if (d < 5.5) danger = { x: car.position.x, z: car.position.z };
    }

    if (!danger) {
      for (const p of this.police.cars) {
        if (!p.active) continue;
        const d = dist2D(ped.position.x, ped.position.z, p.vehicle.position.x, p.vehicle.position.z);
        if (d < 5) {
          danger = { x: p.vehicle.position.x, z: p.vehicle.position.z };
          break;
        }
      }
    }

    if (danger) ped.startFlee(danger.x, danger.z, 3);
  }

  private resolveVehicle(v: Vehicle, others: OBB[], playerCircle: CircleObstacle | null) {
    const obb = v.obb;
    const res = resolveOBB(obb, this.world.aabbs, others);
    let hitPed = false;
    if (playerCircle) {
      hitPed = resolveOBBVsCircles(obb, [playerCircle]);
    }
    v.position.x = obb.x;
    v.position.z = obb.z;
    if (res.collided) {
      v.speed *= 0.35;
    }
    if (hitPed && Math.abs(v.speed) > 4) {
      v.speed *= 0.5;
    }
    v.sync();
  }

  private clampToWorld(v: Vehicle) {
    v.position.x = clamp(v.position.x, WORLD_MIN + 2, WORLD_MAX - 2);
    v.position.z = clamp(v.position.z, WORLD_MIN + 2, WORLD_MAX - 2);
  }

  private allActiveVehicleObbs(): OBB[] {
    const list: OBB[] = [
      ...this.traffic.map((t) => t.vehicle.obb),
      ...this.police.cars.map((p) => p.vehicle.obb),
    ];
    return list;
  }

  private blockedAhead(v: Vehicle): boolean {
    const ahead = 5.0;
    const px = v.position.x + forwardX(v.heading) * ahead;
    const pz = v.position.z + forwardZ(v.heading) * ahead;

    for (const b of this.world.aabbs) {
      if (
        px > b.minX - v.halfX &&
        px < b.maxX + v.halfX &&
        pz > b.minZ - v.halfZ &&
        pz < b.maxZ + v.halfZ
      ) {
        return true;
      }
    }

    const probe: OBB = { x: px, z: pz, halfX: v.halfX * 0.9, halfZ: v.halfZ * 0.9, angle: v.heading };
    for (const e of this.enterableCars) {
      if (e !== v && obbVsObb(probe, e.obb).hit) return true;
    }
    for (const t of this.traffic) {
      if (t.vehicle !== v && obbVsObb(probe, t.vehicle.obb).hit) return true;
    }
    for (const p of this.police.cars) {
      if (p.vehicle !== v && obbVsObb(probe, p.vehicle.obb).hit) return true;
    }
    if (this.player.inVehicle && this.player.inVehicle !== v) {
      if (obbVsObb(probe, this.player.inVehicle.obb).hit) return true;
    }
    return false;
  }

  private handleEnterExit() {
    if (!this.input.consumeEnter()) return;

    if (this.player.inVehicle) {
      const car = this.player.inVehicle;
      if (Math.abs(car.speed) < EXIT_MIN_SPEED) {
        const spot = this.findExitSpot(car);
        this.player.inVehicle = null;
        this.enterableCars.push(car);
        this.player.setPosition(spot.x, spot.z);
      }
    } else {
      let best: Vehicle | null = null;
      let bestD = ENTER_RADIUS;
      for (const v of this.enterableCars) {
        const d = dist2D(this.player.position.x, this.player.position.z, v.position.x, v.position.z);
        if (d < bestD) {
          bestD = d;
          best = v;
        }
      }
      if (best) {
        this.enterableCars = this.enterableCars.filter((v) => v !== best);
        this.player.inVehicle = best;
        this.mission.onEnterVehicle(best === this.missionVehicle);
      }
    }
  }

  private findExitSpot(car: Vehicle): { x: number; z: number } {
    const candidates = [
      this.player.computeExitSpot(car, 1),
      this.player.computeExitSpot(car, -1),
    ];
    const carObbs = [
      ...this.enterableCars.map((v) => v.obb),
      ...this.allActiveVehicleObbs(),
    ];
    let best = candidates[0];
    let bestPenalty = Infinity;
    for (const c of candidates) {
      const r = resolveCircle(c.x, c.z, this.player.radius, this.world.aabbs, carObbs, 1);
      const penalty = dist2D(c.x, c.z, r.x, r.z);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        best = c;
      }
    }
    return best;
  }

  private computeHint(): string {
    if (this.player.inVehicle) {
      return Math.abs(this.player.inVehicle.speed) < EXIT_MIN_SPEED ? "E — Exit car" : "";
    }
    for (const v of this.enterableCars) {
      const d = dist2D(this.player.position.x, this.player.position.z, v.position.x, v.position.z);
      if (d < ENTER_RADIUS) {
        return v === this.missionVehicle ? "E — Enter the marked car" : "E — Enter car";
      }
    }
    return "";
  }

  private pushHud() {
    const car = this.player.inVehicle;
    const state: HudState = {
      mode: car ? "DRIVING" : "ON FOOT",
      speed: car ? Math.round(car.speedKmh) : 0,
      objective: this.mission.objective,
      wanted: this.police.wanted,
      wantedFlash: this.police.wantedFlash,
      hint: this.computeHint(),
      missionComplete: this.mission.complete,
      missionStage: this.mission.stage,
    };
    const json = JSON.stringify(state);
    if (json !== this.lastHudJson) {
      this.lastHudJson = json;
      this.onHud(state);
    }
  }

  restartMission() {
    this.mission.restart();
    if (this.missionVehicle) {
      this.missionVehicle.position.set(MISSION.car.x, 0, MISSION.car.z);
      this.missionVehicle.heading = MISSION.car.heading;
      this.missionVehicle.speed = 0;
      this.missionVehicle.sync();
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.input.detach();
    window.removeEventListener("resize", this.onResize);
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

function buildCarControls(snap: {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  brake: boolean;
}): VehicleControls {
  const throttle = snap.forward ? 1 : snap.back ? -1 : 0;
  const steer = snap.right ? 1 : snap.left ? -1 : 0;
  return { throttle, brake: snap.brake, steer };
}

function computeMoveDir(
  snap: { forward: boolean; back: boolean; left: boolean; right: boolean },
  camYaw: number,
): { x: number; z: number } {
  const fx = Math.sin(camYaw);
  const fz = Math.cos(camYaw);
  const rx = Math.cos(camYaw);
  const rz = -Math.sin(camYaw);

  let x = 0;
  let z = 0;
  if (snap.forward) {
    x += fx;
    z += fz;
  }
  if (snap.back) {
    x -= fx;
    z -= fz;
  }
  if (snap.right) {
    x += rx;
    z += rz;
  }
  if (snap.left) {
    x -= rx;
    z -= rz;
  }
  const len = Math.hypot(x, z);
  if (len > 0.001) {
    x /= len;
    z /= len;
  }
  return { x, z };
}

function buildTrafficLoops(): { outer: Waypoint[]; inner: Waypoint[]; horiz: Waypoint[]; vert: Waypoint[] } {
  const [x0, x1, x2, x3] = ROADS_X;
  const [z0, z1, z2, z3] = ROADS_Z;
  return {
    outer: [
      { x: x0, z: z0 },
      { x: x3, z: z0 },
      { x: x3, z: z3 },
      { x: x0, z: z3 },
    ],
    inner: [
      { x: x1, z: z1 },
      { x: x2, z: z1 },
      { x: x2, z: z2 },
      { x: x1, z: z2 },
    ],
    horiz: [
      { x: x0, z: z1 },
      { x: x3, z: z1 },
      { x: x3, z: z2 },
      { x: x0, z: z2 },
    ],
    vert: [
      { x: x1, z: z0 },
      { x: x1, z: z3 },
      { x: x2, z: z3 },
      { x: x2, z: z0 },
    ],
  };
}
