import { useEffect, useRef, useState } from 'react';
import { CrashEngine } from './physics/engine';
import { EngineContext } from './three/engineContext';
import { Scene } from './three/Scene';
import { ControlPanel } from './ui/ControlPanel';
import { ResultPanel } from './ui/ResultPanel';
import { HistoryTable } from './ui/HistoryTable';
import { ModelInfo } from './ui/ModelInfo';
import { CrashConfig, ResultData, Phase } from './types';

interface LiveStats {
  speedKmh: number;
  x: number;
  z: number;
  impactKmh: number;
}

export default function App() {
  const engineRef = useRef<CrashEngine | null>(null);
  if (!engineRef.current) engineRef.current = new CrashEngine();
  const engine = engineRef.current;

  const [config, setConfig] = useState<CrashConfig>({
    speedKmh: 100,
    massKg: 1500,
    angleDeg: 0,
    obstacle: 'concrete-wall',
  });
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<ResultData | null>(null);
  const [history, setHistory] = useState<ResultData[]>([]);
  const [slowMo, setSlowMo] = useState(false);
  const [live, setLive] = useState<LiveStats>({
    speedKmh: 0,
    x: 0,
    z: 0,
    impactKmh: 0,
  });

  useEffect(() => {
    engine.onSettle = (r) => {
      setResult(r);
      setPhase('settled');
      setHistory((h) => [r, ...h].slice(0, 5));
    };
    engine.onImpact = () => {
      setLive((l) => ({ ...l, impactKmh: engine.impactSpeedMs * 3.6 }));
    };
    engine.configure({ ...config });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll the engine for live speed/position while a run is active.
  useEffect(() => {
    if (phase !== 'running' && phase !== 'paused') return;
    const id = window.setInterval(() => {
      setLive({
        speedKmh: engine.car.speed() * 3.6,
        x: engine.car.pos.x,
        z: engine.car.pos.z,
        impactKmh: engine.impactSpeedMs * 3.6,
      });
    }, 120);
    return () => window.clearInterval(id);
  }, [phase, engine]);

  const updateConfig = (next: CrashConfig) => {
    setConfig(next);
    if (engine.phase === 'idle' || engine.phase === 'settled') {
      engine.configure(next);
      setPhase('idle');
      setResult(null);
    }
  };

  const runCrash = () => {
    engine.config = { ...config };
    engine.run();
    setResult(null);
    setLive({ speedKmh: config.speedKmh, x: engine.car.pos.x, z: engine.car.pos.z, impactKmh: 0 });
    setPhase('running');
  };

  const reset = () => {
    engine.config = { ...config };
    engine.reset();
    setPhase('idle');
    setResult(null);
    setLive({ speedKmh: 0, x: engine.car.pos.x, z: engine.car.pos.z, impactKmh: 0 });
  };

  const togglePause = () => {
    if (engine.phase === 'running') {
      engine.pause();
      setPhase('paused');
    } else if (engine.phase === 'paused') {
      engine.resume();
      setPhase('running');
    }
  };

  const toggleSlowMo = () => {
    const next = !slowMo;
    setSlowMo(next);
    engine.timeScale = next ? 0.25 : 1;
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Car Crash Lab</h1>
        <span className="subtitle">Interactive real-time 3D crash test</span>
      </header>

      <div className="main">
        <div className="viewport">
          <EngineContext.Provider value={engine}>
            <Scene />
          </EngineContext.Provider>
          <div className="viewport-status">
            <span className={`phase phase-${phase}`}>{phase.toUpperCase()}</span>
            <span className="pos">
              X {live.x.toFixed(1)} m · Z {live.z.toFixed(1)} m
            </span>
          </div>
        </div>

        <aside className="sidebar">
          <ControlPanel
            config={config}
            phase={phase}
            slowMo={slowMo}
            liveSpeedKmh={live.speedKmh}
            liveImpactKmh={live.impactKmh}
            onChange={updateConfig}
            onRun={runCrash}
            onReset={reset}
            onTogglePause={togglePause}
            onToggleSlowMo={toggleSlowMo}
          />
          <ResultPanel result={result} />
          <HistoryTable history={history} />
        </aside>
      </div>

      <ModelInfo />
    </div>
  );
}
