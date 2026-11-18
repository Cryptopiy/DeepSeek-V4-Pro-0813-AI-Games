import { useCallback, useEffect, useRef, useState } from 'react';
import { Simulation } from './sim/simulation';
import { Stats, SimStatus } from './sim/types';
import { SimScene } from './render/Scene';

const WAVE_MIN = 1;
const WAVE_MAX = 20;

export default function App() {
  const simRef = useRef<Simulation | null>(null);
  if (!simRef.current) simRef.current = new Simulation();
  const sim = simRef.current;

  const [waveHeight, setWaveHeight] = useState(8);
  const [status, setStatus] = useState<SimStatus>('idle');
  const [speed, setSpeed] = useState(1);
  const [stats, setStats] = useState<Stats>(() => sim.getStats());

  useEffect(() => {
    sim.waveHeight = waveHeight;
  }, [waveHeight, sim]);

  useEffect(() => {
    sim.speed = speed;
  }, [speed, sim]);

  useEffect(() => {
    const id = setInterval(() => {
      setStats(sim.getStats());
      setStatus(sim.status);
    }, 120);
    return () => clearInterval(id);
  }, [sim]);

  const handleStart = useCallback(() => {
    sim.waveHeight = waveHeight;
    sim.start();
    setStatus(sim.status);
  }, [sim, waveHeight]);

  const handleReset = useCallback(() => {
    sim.reset();
    setStats(sim.getStats());
    setStatus(sim.status);
  }, [sim]);

  const handlePause = useCallback(() => {
    sim.pause();
    setStatus(sim.status);
  }, [sim]);

  return (
    <div className="app">
      <SimScene sim={sim} />
      <ControlPanel
        waveHeight={waveHeight}
        setWaveHeight={setWaveHeight}
        speed={speed}
        setSpeed={setSpeed}
        status={status}
        onStart={handleStart}
        onReset={handleReset}
        onPause={handlePause}
      />
      <StatsPanel stats={stats} />
      <Legend />
      <div className="title">
        <h1>TSUNAMI DISASTER SIMULATOR</h1>
        <p className="hint">Drag to orbit · Scroll to zoom · Right-drag to pan</p>
      </div>
    </div>
  );
}

function ControlPanel(props: {
  waveHeight: number;
  setWaveHeight: (v: number) => void;
  speed: number;
  setSpeed: (v: number) => void;
  status: SimStatus;
  onStart: () => void;
  onReset: () => void;
  onPause: () => void;
}) {
  return (
    <div className="panel">
      <div className="row">
        <label>Wave height</label>
        <span className="value">{props.waveHeight.toFixed(0)} m</span>
      </div>
      <input
        type="range"
        min={WAVE_MIN}
        max={WAVE_MAX}
        step={1}
        value={props.waveHeight}
        onChange={(e) => props.setWaveHeight(Number(e.target.value))}
        disabled={props.status === 'running'}
      />
      <div className="range-labels">
        <span>1 m</span>
        <span>20 m</span>
      </div>

      <div className="row">
        <label>Speed</label>
        <span className="value">{props.speed.toFixed(1)}×</span>
      </div>
      <input
        type="range"
        min={0.5}
        max={3}
        step={0.5}
        value={props.speed}
        onChange={(e) => props.setSpeed(Number(e.target.value))}
      />

      <div className="buttons">
        {props.status === 'running' ? (
          <button className="pause" onClick={props.onPause}>
            PAUSE
          </button>
        ) : (
          <button className="start" onClick={props.onStart} disabled={props.status === 'paused'}>
            {props.status === 'paused' ? 'PAUSED' : 'START TSUNAMI'}
          </button>
        )}
        {props.status === 'paused' && (
          <button className="pause" onClick={props.onPause}>
            RESUME
          </button>
        )}
        <button className="reset" onClick={props.onReset}>
          RESET
        </button>
      </div>
    </div>
  );
}

function StatsPanel({ stats }: { stats: Stats }) {
  const pct = (stats.floodedFraction * 100).toFixed(1);
  return (
    <div className="stats">
      <div className="stat flood">
        <span className="label">Flooded Area</span>
        <span className="big">{pct}%</span>
      </div>
      <div className="stat">
        <span className="label">Max depth</span>
        <span className="num">{stats.maxDepth.toFixed(1)} m</span>
      </div>
      <div className="stat">
        <span className="label">Flooded buildings</span>
        <span className="num">
          {stats.floodedBuildings}/{stats.totalBuildings}
        </span>
      </div>
      <div className="stat">
        <span className="label">Displaced vehicles</span>
        <span className="num">
          {stats.displacedVehicles}/{stats.totalVehicles}
        </span>
      </div>
      <div className="stat">
        <span className="label">People safe</span>
        <span className="num">
          {stats.safePeople}/{stats.totalPeople}
        </span>
      </div>
      <div className="stat">
        <span className="label">Elapsed</span>
        <span className="num">{stats.elapsed.toFixed(1)} s</span>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="legend">
      <div className="legend-title">Elevation</div>
      <div className="legend-bar" />
      <div className="legend-labels">
        <span>-26 m</span>
        <span>0 m</span>
        <span>+20 m</span>
      </div>
      <div className="legend-note">Ocean on the west · Safe hill to the east</div>
    </div>
  );
}
