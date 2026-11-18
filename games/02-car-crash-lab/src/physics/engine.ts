import { Body } from './rigidbody';
import { collideOBB, CollisionResult } from './obb';
import { V2, v2, add, sub, scale, dot, cross, perp, rotate, clamp } from './vec';
import { mulberry32, randRange } from './rng';
import { computeDamagePct, computeZoneDamage, severityFromDamage } from './damage';
import { OBSTACLES, ObstacleDef } from '../obstacles';
import {
  CrashConfig,
  ResultData,
  Phase,
  ZoneDamage,
  DamageZone,
  DebrisParticle,
  Spark,
  SkidMark,
} from '../types';
import {
  CAR_HALF,
  CAR_RESTITUTION,
  CAR_FRICTION,
  START_DISTANCE,
  IMPACT_DURATION,
  FIXED_DT,
  MAX_SIM_TIME,
  KMH_TO_MS,
} from '../config';

const GRAVITY = 9.81;

// The crash engine drives the deterministic, fixed-timestep rigid-body
// simulation and exposes mutable state that the 3D scene reads every frame.
export class CrashEngine {
  config: CrashConfig;
  phase: Phase = 'idle';
  time = 0;
  timeScale = 1; // slow-motion factor
  shake = 0; // screen-shake magnitude (visual)

  car: Body;
  obstacle: Body;
  obstacleDef: ObstacleDef;

  debris: DebrisParticle[] = [];
  sparks: Spark[] = [];
  skids: SkidMark[] = [];

  zoneDamage: ZoneDamage = { front: 0, rear: 0, left: 0, right: 0 };
  damagePct = 0;
  impactZone: DamageZone = 'front';
  impactForceN = 0;
  impactSpeedMs = 0;
  keBeforeJ = 0;
  keAfterJ = 0;

  onSettle: ((r: ResultData) => void) | null = null;
  onImpact: (() => void) | null = null;

  private accumulator = 0;
  private rng: () => number = mulberry32(12345);
  private nextId = 1;

  impacted = false;
  private lastContact: V2 = v2();
  private skidTimer = 0;
  private settledCounter = 0;
  private settledFired = false;

  constructor() {
    this.config = {
      speedKmh: 100,
      massKg: 1500,
      angleDeg: 0,
      obstacle: 'concrete-wall',
    };
    this.obstacleDef = OBSTACLES[this.config.obstacle];
    this.car = new Body({
      mass: this.config.massKg,
      half: CAR_HALF,
      restitution: CAR_RESTITUTION,
      friction: CAR_FRICTION,
    });
    this.obstacle = new Body({
      mass: this.obstacleDef.massKg,
      half: this.obstacleDef.half,
      restitution: this.obstacleDef.restitution,
      friction: this.obstacleDef.friction,
    });
    this.placeBodies();
  }

  private placeBodies(): void {
    const angle = (this.config.angleDeg * Math.PI) / 180;
    const d = START_DISTANCE;
    this.car.pos = v2(-d, -d * Math.tan(angle));
    this.car.vel = v2(0, 0);
    this.car.angle = angle;
    this.car.angVel = 0;
    this.obstacle.pos = v2(0, 0);
    this.obstacle.vel = v2(0, 0);
    this.obstacle.angle = 0;
    this.obstacle.angVel = 0;
  }

  // Rebuild bodies from config, reset all transient state.
  private applyConfig(): void {
    this.obstacleDef = OBSTACLES[this.config.obstacle];
    this.car = new Body({
      mass: this.config.massKg,
      half: CAR_HALF,
      restitution: CAR_RESTITUTION,
      friction: CAR_FRICTION,
    });
    this.obstacle = new Body({
      mass: this.obstacleDef.massKg,
      half: this.obstacleDef.half,
      restitution: this.obstacleDef.restitution,
      friction: this.obstacleDef.friction,
    });
    this.time = 0;
    this.accumulator = 0;
    this.debris = [];
    this.sparks = [];
    this.skids = [];
    this.shake = 0;
    this.impacted = false;
    this.skidTimer = 0;
    this.settledCounter = 0;
    this.settledFired = false;
    this.zoneDamage = { front: 0, rear: 0, left: 0, right: 0 };
    this.damagePct = 0;
    this.impactForceN = 0;
    this.impactSpeedMs = 0;
    this.keBeforeJ = 0;
    this.keAfterJ = 0;
    this.impactZone = 'front';
    this.rng = mulberry32(12345);
    this.placeBodies();
  }

  reset(): void {
    this.applyConfig();
    this.phase = 'idle';
  }

  configure(cfg: CrashConfig): void {
    this.config = cfg;
    this.applyConfig();
    this.phase = 'idle';
  }

  run(): void {
    this.applyConfig();
    const angle = (this.config.angleDeg * Math.PI) / 180;
    const speed = this.config.speedKmh * KMH_TO_MS;
    this.car.vel = v2(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.keBeforeJ = 0.5 * this.config.massKg * speed * speed;
    this.phase = 'running';
  }

  pause(): void {
    if (this.phase === 'running') this.phase = 'paused';
  }

  resume(): void {
    if (this.phase === 'paused') this.phase = 'running';
  }

  // Called every rendered frame with the real elapsed time.
  frame(deltaReal: number): void {
    const delta = Math.min(deltaReal, 0.1) * this.timeScale;

    if (this.phase === 'running') {
      this.accumulator += delta;
      if (this.accumulator > 0.05) this.accumulator = 0.05;
      let guard = 0;
      while (this.accumulator >= FIXED_DT && guard < 400) {
        this.stepPhysics(FIXED_DT);
        this.accumulator -= FIXED_DT;
        guard++;
      }
    }

    if (this.phase === 'running' || this.phase === 'settled') {
      this.updateDebris(delta);
      this.updateSparks(delta);
      this.updateSkids(delta);
      this.shake = Math.max(0, this.shake * (1 - 4 * delta) - 0.02 * delta);
    }
  }

  private stepPhysics(dt: number): void {
    this.time += dt;

    this.applyGroundForces(this.car, dt);
    if (this.obstacle.movable) this.applyGroundForces(this.obstacle, dt);

    this.car.integrate(dt);
    this.obstacle.integrate(dt);

    const col = collideOBB(this.car.obb, this.obstacle.obb);
    if (col.hit) this.resolveCollision(col);

    this.clampState();

    if (this.impacted) this.emitSkid(dt);

    this.checkSettled();
  }

  private applyGroundForces(b: Body, dt: number): void {
    if (!b.movable) return;
    const sp = b.speed();
    if (sp < 1e-6) {
      b.vel = v2(0, 0);
      b.angVel *= Math.exp(-2 * dt);
      if (Math.abs(b.angVel) < 0.0005) b.angVel = 0;
      return;
    }
    // Pre-impact: light drag (near-constant cruise). Post-impact: skidding friction.
    const mu = this.impacted ? 0.55 : 0.005;
    const aRoll = mu * GRAVITY;
    const aAir = 0.0005 * sp * sp;
    const decel = Math.min((aRoll + aAir) * dt, sp);
    const newSp = sp - decel;
    b.vel = newSp > 1e-6 ? scale(b.vel, newSp / sp) : v2(0, 0);
    b.angVel *= Math.exp(-0.6 * dt);
    if (Math.abs(b.angVel) < 0.0005) b.angVel = 0;
  }

  private resolveCollision(col: CollisionResult): void {
    const n = col.normal; // points from obstacle toward car
    const rA = sub(col.point, this.car.pos);
    const rB = sub(col.point, this.obstacle.pos);

    const carSpeedBefore = this.car.speed();

    const vRel = sub(this.car.velocityAt(col.point), this.obstacle.velocityAt(col.point));
    const vn = dot(vRel, n);
    if (vn > 0) return; // already separating

    const e = this.obstacleDef.restitution;
    const rnA = cross(rA, n);
    const rnB = cross(rB, n);
    const invMassSum =
      this.car.invMass +
      this.obstacle.invMass +
      this.car.invInertia * rnA * rnA +
      this.obstacle.invInertia * rnB * rnB;
    if (invMassSum <= 0) return;

    const jn = (-(1 + e) * vn) / invMassSum;
    const impulse = scale(n, jn);
    this.car.applyImpulse(impulse, col.point);
    this.obstacle.applyImpulse(scale(impulse, -1), col.point);

    // Coulomb friction (tangential impulse).
    const t = perp(n);
    const vRelAfter = sub(this.car.velocityAt(col.point), this.obstacle.velocityAt(col.point));
    const vt = dot(vRelAfter, t);
    const invMassSumT =
      this.car.invMass +
      this.obstacle.invMass +
      this.car.invInertia * cross(rA, t) * cross(rA, t) +
      this.obstacle.invInertia * cross(rB, t) * cross(rB, t);
    if (invMassSumT > 0) {
      const mu = (this.car.friction + this.obstacle.friction) / 2;
      let jt = -vt / invMassSumT;
      const maxJt = mu * jn;
      jt = clamp(jt, -maxJt, maxJt);
      const fImp = scale(t, jt);
      this.car.applyImpulse(fImp, col.point);
      this.obstacle.applyImpulse(scale(fImp, -1), col.point);
    }

    // Positional correction to separate the penetrating bodies.
    const slop = 0.001;
    const correction = (0.8 * Math.max(0, col.depth - slop)) / invMassSum;
    this.car.pos = add(this.car.pos, scale(n, correction * this.car.invMass));
    this.obstacle.pos = add(this.obstacle.pos, scale(n, -correction * this.obstacle.invMass));

    this.lastContact = col.point;

    if (!this.impacted) {
      this.impacted = true;
      const vnApproach = -vn;
      const mEff =
        this.car.invMass + this.obstacle.invMass > 0
          ? 1 / (this.car.invMass + this.obstacle.invMass)
          : this.car.mass;
      this.impactSpeedMs = carSpeedBefore;
      this.damagePct = computeDamagePct(mEff, vnApproach, e, this.obstacleDef.rigidity);
      const zd = computeZoneDamage(this.damagePct, n, this.car.angle);
      this.zoneDamage = zd.zones;
      this.impactZone = zd.primary;
      this.impactForceN = (mEff * (1 + e) * vnApproach) / IMPACT_DURATION;
      this.spawnImpactEffects(col.point, vnApproach);
      this.shake = Math.max(this.shake, clamp(0.25 + this.impactSpeedMs * 0.02, 0.25, 1.2));
      this.onImpact?.();
    }
  }

  private updateDebris(dt: number): void {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const p = this.debris[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.debris.splice(i, 1);
        continue;
      }
      p.vy -= GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.04) {
        p.y = 0.04;
        p.vy = -p.vy * 0.3;
        p.vx *= 0.55;
        p.vz *= 0.55;
        p.angV *= 0.5;
      }
      p.rotX += p.angV * dt;
      p.rotZ += p.angV * 0.7 * dt;
    }
  }

  private updateSparks(dt: number): void {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }
      p.vy -= GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.02) {
        p.life = 0;
      }
    }
  }

  private updateSkids(dt: number): void {
    for (let i = this.skids.length - 1; i >= 0; i--) {
      const s = this.skids[i];
      s.alpha -= dt * 0.25;
      if (s.alpha <= 0) this.skids.splice(i, 1);
    }
  }

  private clampState(): void {
    const maxSpeed = 120;
    const c = this.car;
    if (c.speed() > maxSpeed) c.vel = scale(c.vel, maxSpeed / c.speed());
    if (Math.abs(c.angVel) > 30) c.angVel = Math.sign(c.angVel) * 30;
    const o = this.obstacle;
    if (o.movable && o.speed() > maxSpeed) o.vel = scale(o.vel, maxSpeed / o.speed());
    if (Math.abs(o.angVel) > 30) o.angVel = Math.sign(o.angVel) * 30;
  }

  private spawnImpactEffects(point: V2, vnApproach: number): void {
    const speed = this.impactSpeedMs;
    const base = speed * KMH_TO_MS;

    const debrisCount = Math.round(clamp(6 + this.damagePct * 0.22, 6, 26));
    for (let i = 0; i < debrisCount; i++) {
      const ang = this.rng() * Math.PI * 2;
      const hSpeed = (1.5 + base * 0.25) * (0.4 + this.rng() * 0.9);
      this.debris.push({
        id: this.nextId++,
        x: point.x + randRange(this.rng, -0.3, 0.3),
        y: randRange(this.rng, 0.3, 0.9),
        z: point.z + randRange(this.rng, -0.3, 0.3),
        vx: Math.cos(ang) * hSpeed,
        vy: randRange(this.rng, 2, 7),
        vz: Math.sin(ang) * hSpeed,
        rotX: this.rng() * Math.PI,
        rotZ: this.rng() * Math.PI,
        angV: randRange(this.rng, 2, 10),
        size: randRange(this.rng, 0.08, 0.28),
        life: randRange(this.rng, 1.2, 2.6),
        maxLife: 2.6,
        color: this.rng() > 0.5 ? '#c62828' : '#37474f',
      });
    }

    if (base > 12) {
      const sparkCount = Math.round(clamp(base * 0.8, 6, 40));
      for (let i = 0; i < sparkCount; i++) {
        const ang = this.rng() * Math.PI * 2;
        const spd = randRange(this.rng, 3, 8) + base * 0.15;
        this.sparks.push({
          id: this.nextId++,
          x: point.x,
          y: randRange(this.rng, 0.2, 0.7),
          z: point.z,
          vx: Math.cos(ang) * spd,
          vy: randRange(this.rng, 1, 6),
          vz: Math.sin(ang) * spd,
          life: randRange(this.rng, 0.2, 0.6),
          maxLife: 0.6,
        });
      }
    }
  }

  private emitSkid(dt: number): void {
    this.skidTimer -= dt;
    if (this.skidTimer > 0) return;
    const c = this.car;
    const localVel = rotate(c.vel, -c.angle);
    const sliding = Math.abs(localVel.z) > 0.6 || Math.abs(c.angVel) > 0.15;
    if (c.speed() < 0.5 || !sliding) return;
    this.skidTimer = 0.03;
    const wheelLocal = [
      v2(-1.35, -0.78),
      v2(-1.35, 0.78),
    ];
    const len = clamp(c.speed() * 0.06, 0.2, 1.2);
    for (const wl of wheelLocal) {
      const wp = add(c.pos, rotate(wl, c.angle));
      this.skids.push({
        x: wp.x,
        z: wp.z,
        angle: c.angle,
        length: len,
        width: 0.14,
        alpha: 0.5,
      });
    }
    if (this.skids.length > 600) this.skids.splice(0, this.skids.length - 600);
  }

  private checkSettled(): void {
    if (this.settledFired) return;
    if (!this.impacted) return;
    const c = this.car;
    const o = this.obstacle;
    const still =
      c.speed() < 0.15 &&
      Math.abs(c.angVel) < 0.03 &&
      (o.speed() < 0.15 || !o.movable) &&
      (Math.abs(o.angVel) < 0.03 || !o.movable);
    if (still) {
      this.settledCounter++;
    } else {
      this.settledCounter = 0;
    }
    if (this.settledCounter >= 60 || this.time >= MAX_SIM_TIME) {
      this.settledFired = true;
      this.finalize();
    }
  }

  private finalize(): void {
    const c = this.car;
    const o = this.obstacle;
    const keCar = 0.5 * c.mass * c.speed() * c.speed();
    const keObs = o.movable ? 0.5 * o.mass * o.speed() * o.speed() : 0;
    this.keAfterJ = keCar + keObs;

    const cfg = this.config;
    const result: ResultData = {
      id: this.nextId++,
      speedInitialKmh: cfg.speedKmh,
      speedImpactKmh: this.impactSpeedMs * 3.6,
      massKg: cfg.massKg,
      angleDeg: cfg.angleDeg,
      obstacle: cfg.obstacle,
      impactForceN: this.impactForceN,
      damagePct: this.damagePct,
      severity: severityFromDamage(this.damagePct),
      impactZone: this.impactZone,
      finalX: c.pos.x,
      finalZ: c.pos.z,
      finalYawDeg: (c.angle * 180) / Math.PI,
      keBeforeJ: this.keBeforeJ,
      keAfterJ: this.keAfterJ,
      zoneDamage: { ...this.zoneDamage },
    };
    this.phase = 'settled';
    this.onSettle?.(result);
  }
}
