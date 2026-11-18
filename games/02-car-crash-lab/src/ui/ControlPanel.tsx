import { CrashConfig, Phase, ObstacleKind } from '../types';
import { OBSTACLES, OBSTACLE_ORDER } from '../obstacles';
import { SPEED_MIN, SPEED_MAX, MASS_MIN, MASS_MAX, ANGLE_MIN, ANGLE_MAX } from '../config';
import { fmt } from '../utils/format';

interface Props {
  config: CrashConfig;
  phase: Phase;
  slowMo: boolean;
  liveSpeedKmh: number;
  liveImpactKmh: number;
  onChange: (cfg: CrashConfig) => void;
  onRun: () => void;
  onReset: () => void;
  onTogglePause: () => void;
  onToggleSlowMo: () => void;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="slider">
      <div className="slider-head">
        <span className="slider-label">{label}</span>
        <span className="slider-value">
          {display} <span className="unit">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function ControlPanel({
  config,
  phase,
  slowMo,
  liveSpeedKmh,
  liveImpactKmh,
  onChange,
  onRun,
  onReset,
  onTogglePause,
  onToggleSlowMo,
}: Props) {
  const set = (patch: Partial<CrashConfig>) => onChange({ ...config, ...patch });
  const running = phase === 'running' || phase === 'paused';

  return (
    <section className="panel">
      <h2>Experiment parameters</h2>

      <Slider
        label="Vehicle speed"
        value={config.speedKmh}
        min={SPEED_MIN}
        max={SPEED_MAX}
        step={1}
        unit="km/h"
        display={fmt(config.speedKmh, 0)}
        onChange={(v) => set({ speedKmh: v })}
      />
      <Slider
        label="Vehicle mass"
        value={config.massKg}
        min={MASS_MIN}
        max={MASS_MAX}
        step={10}
        unit="kg"
        display={fmt(config.massKg, 0)}
        onChange={(v) => set({ massKg: v })}
      />
      <Slider
        label="Collision angle"
        value={config.angleDeg}
        min={ANGLE_MIN}
        max={ANGLE_MAX}
        step={1}
        unit="deg"
        display={config.angleDeg > 0 ? `+${config.angleDeg}` : `${config.angleDeg}`}
        onChange={(v) => set({ angleDeg: v })}
      />

      <div className="obstacle-group">
        <span className="slider-label">Obstacle type</span>
        <div className="obstacle-list">
          {OBSTACLE_ORDER.map((kind: ObstacleKind) => {
            const def = OBSTACLES[kind];
            return (
              <button
                key={kind}
                className={`obstacle-btn ${config.obstacle === kind ? 'active' : ''}`}
                onClick={() => set({ obstacle: kind })}
              >
                <span className="swatch" style={{ background: def.color }} />
                <span className="obstacle-info">
                  <strong>{def.label}</strong>
                  <small>{def.description}</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="live-readout">
        <div>
          <span className="live-label">Current speed</span>
          <span className="live-value">{fmt(liveSpeedKmh, 1)} km/h</span>
        </div>
        <div>
          <span className="live-label">Impact speed</span>
          <span className="live-value">
            {liveImpactKmh > 0 ? `${fmt(liveImpactKmh, 1)} km/h` : '—'}
          </span>
        </div>
      </div>

      <div className="actions">
        <button className="btn run" onClick={onRun} disabled={running}>
          RUN CRASH
        </button>
        <button className="btn" onClick={onTogglePause} disabled={!running}>
          {phase === 'paused' ? 'RESUME' : 'PAUSE'}
        </button>
        <button className="btn" onClick={onReset} disabled={phase === 'idle'}>
          RESET
        </button>
        <button
          className={`btn ${slowMo ? 'active' : ''}`}
          onClick={onToggleSlowMo}
          disabled={!running}
        >
          SLOW-MO
        </button>
      </div>
    </section>
  );
}
