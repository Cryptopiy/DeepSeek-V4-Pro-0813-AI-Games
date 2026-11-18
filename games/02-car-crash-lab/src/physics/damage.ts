import { V2, clamp, rotate } from './vec';
import { CAR_RIGIDITY, E0_DAMAGE } from '../config';
import { DamageZone, ZoneDamage } from '../types';

// Damage is derived from the energy dissipated in deforming the vehicle.
//
//   E_diss  = 0.5 * m_eff * v_n^2 * (1 - e^2)     (total dissipated energy)
//   E_car   = E_diss * rigidity / (rigidity + carRigidity)
//   damage  = 100 * (1 - exp(-E_car / E0))
//
// where:
//   m_eff  = reduced mass (m_car * m_obs / (m_car + m_obs), wall => m_car)
//   v_n    = normal (closing) component of the relative impact velocity
//   e      = restitution of the obstacle pair
//   rigidity = obstacle rigidity (wall absorbs almost nothing, car deforms most)
export function computeDamagePct(
  mEff: number,
  vn: number,
  restitution: number,
  rigidity: number,
): number {
  const eDiss = 0.5 * mEff * vn * vn * (1 - restitution * restitution);
  const carShare = rigidity / (rigidity + CAR_RIGIDITY);
  const eCar = eDiss * carShare;
  return clamp(100 * (1 - Math.exp(-eCar / E0_DAMAGE)), 0, 100);
}

// Convert the world-space impact normal into the car's local frame and map it
// to per-zone damage so the deformation appears on the correct side.
export function computeZoneDamage(
  damagePct: number,
  normal: V2,
  carAngle: number,
): { zones: ZoneDamage; primary: DamageZone } {
  const n = rotate(normal, -carAngle);
  // local +x = front, -x = rear, -z = right side, +z = left side
  const front = clamp(-n.x, 0, 1);
  const rear = clamp(n.x, 0, 1);
  const right = clamp(-n.z, 0, 1);
  const left = clamp(n.z, 0, 1);

  const maxW = Math.max(front, rear, left, right, 1e-6);
  const zones: ZoneDamage = {
    front: clamp((damagePct * front) / maxW, 0, 100),
    rear: clamp((damagePct * rear) / maxW, 0, 100),
    left: clamp((damagePct * left) / maxW, 0, 100),
    right: clamp((damagePct * right) / maxW, 0, 100),
  };

  let primary: DamageZone = 'front';
  let best = front;
  if (rear > best) {
    best = rear;
    primary = 'rear';
  }
  if (left > best) {
    best = left;
    primary = 'left';
  }
  if (right > best) {
    best = right;
    primary = 'right';
  }

  return { zones, primary };
}

export function severityFromDamage(pct: number): string {
  if (pct >= 80) return 'Catastrophic';
  if (pct >= 50) return 'Severe';
  if (pct >= 20) return 'Moderate';
  return 'Minor';
}
