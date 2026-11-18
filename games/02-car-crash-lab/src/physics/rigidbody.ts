import { V2, v2 } from './vec';
import { OBB } from './obb';

export interface BodyOptions {
  mass: number; // kg; Infinity => immovable
  half: V2;
  restitution: number;
  friction: number;
  angle?: number;
}

// A rigid body constrained to the ground plane (XZ). Rotation is yaw only.
export class Body {
  mass: number;
  invMass: number;
  half: V2;
  pos: V2;
  vel: V2;
  angle: number;
  angVel: number;
  inertia: number;
  invInertia: number;
  restitution: number;
  friction: number;
  movable: boolean;

  constructor(o: BodyOptions) {
    this.mass = o.mass;
    this.movable = Number.isFinite(o.mass);
    this.invMass = this.movable ? 1 / o.mass : 0;
    this.half = { x: o.half.x, z: o.half.z };
    this.pos = v2();
    this.vel = v2();
    this.angle = o.angle ?? 0;
    this.angVel = 0;
    const w = 2 * this.half.x;
    const l = 2 * this.half.z;
    this.inertia = this.movable ? (this.mass / 12) * (w * w + l * l) : Infinity;
    this.invInertia = this.movable ? 1 / this.inertia : 0;
    this.restitution = o.restitution;
    this.friction = o.friction;
  }

  get obb(): OBB {
    return { center: this.pos, half: this.half, angle: this.angle };
  }

  // Linear velocity of the point `p` on the body (accounting for yaw rotation).
  velocityAt(p: V2): V2 {
    const rx = p.x - this.pos.x;
    const rz = p.z - this.pos.z;
    return v2(this.vel.x + this.angVel * rz, this.vel.z - this.angVel * rx);
  }

  applyImpulse(j: V2, p: V2): void {
    if (!this.movable) return;
    this.vel.x += j.x * this.invMass;
    this.vel.z += j.z * this.invMass;
    const rx = p.x - this.pos.x;
    const rz = p.z - this.pos.z;
    this.angVel += this.invInertia * (rx * j.z - rz * j.x);
  }

  integrate(dt: number): void {
    if (!this.movable) return;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.angle += this.angVel * dt;
  }

  speed(): number {
    return Math.hypot(this.vel.x, this.vel.z);
  }
}
