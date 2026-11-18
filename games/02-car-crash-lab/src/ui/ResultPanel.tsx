import { ResultData } from '../types';
import { OBSTACLES } from '../obstacles';
import { fmt, kN, kJ, deg, normalizeDeg } from '../utils/format';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="result-row">
      <span className="result-label">{label}</span>
      <span className="result-value">{value}</span>
    </div>
  );
}

function severityClass(pct: number): string {
  if (pct >= 80) return 'catastrophic';
  if (pct >= 50) return 'severe';
  if (pct >= 20) return 'moderate';
  return 'minor';
}

export function ResultPanel({ result }: { result: ResultData | null }) {
  if (!result) {
    return (
      <section className="panel result-panel">
        <h2>Result</h2>
        <p className="muted">Run a crash to see post-impact measurements.</p>
      </section>
    );
  }

  const def = OBSTACLES[result.obstacle];

  return (
    <section className="panel result-panel">
      <h2>Result</h2>
      <div className={`severity-badge ${severityClass(result.damagePct)}`}>
        {result.severity} — {fmt(result.damagePct, 1)}%
      </div>

      <Row label="Configured speed" value={`${fmt(result.speedInitialKmh, 0)} km/h`} />
      <Row label="Impact speed" value={`${fmt(result.speedImpactKmh, 1)} km/h`} />
      <Row label="Vehicle mass" value={`${fmt(result.massKg, 0)} kg`} />
      <Row label="Collision angle" value={deg(result.angleDeg)} />
      <Row label="Obstacle" value={def.label} />
      <Row label="Impact zone" value={result.impactZone} />
      <Row label="Est. impact force" value={kN(result.impactForceN)} />
      <Row label="Damage" value={`${fmt(result.damagePct, 1)} %`} />
      <Row
        label="Final position"
        value={`X ${fmt(result.finalX, 1)} m · Z ${fmt(result.finalZ, 1)} m`}
      />
      <Row label="Final rotation" value={deg(normalizeDeg(result.finalYawDeg))} />
      <Row
        label="Kinetic energy"
        value={`${kJ(result.keBeforeJ)} → ${kJ(result.keAfterJ)}`}
      />

      <p className="assumption">
        Force estimate assumes an impact duration of 80 ms (F = Δp / Δt). Damage is
        derived from the energy absorbed by the vehicle (see Model).
      </p>
    </section>
  );
}
