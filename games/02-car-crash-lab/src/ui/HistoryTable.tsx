import { ResultData } from '../types';
import { OBSTACLES } from '../obstacles';
import { fmt, kN } from '../utils/format';

export function HistoryTable({ history }: { history: ResultData[] }) {
  if (history.length === 0) {
    return (
      <section className="panel">
        <h2>Last runs</h2>
        <p className="muted">Completed crashes will appear here for comparison.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Last runs</h2>
      <div className="table-wrap">
        <table className="history-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Speed</th>
              <th>Mass</th>
              <th>Angle</th>
              <th>Obstacle</th>
              <th>Force</th>
              <th>Damage</th>
            </tr>
          </thead>
          <tbody>
            {history.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{fmt(r.speedInitialKmh, 0)} km/h</td>
                <td>{fmt(r.massKg, 0)} kg</td>
                <td>{fmt(r.angleDeg, 0)}°</td>
                <td>{OBSTACLES[r.obstacle].label}</td>
                <td>{kN(r.impactForceN)}</td>
                <td>{fmt(r.damagePct, 0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
