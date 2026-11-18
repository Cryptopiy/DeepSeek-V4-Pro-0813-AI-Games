import { useEffect, useRef, useState } from "react";
import { Game } from "./game/Game";
import type { HudState } from "./game/types";

const INITIAL_HUD: HudState = {
  mode: "ON FOOT",
  speed: 0,
  objective: "Walk to the pickup marker",
  wanted: 0,
  wantedFlash: false,
  hint: "",
  missionComplete: false,
  missionStage: 0,
};

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const game = new Game(container, (h) => setHud(h));
    gameRef.current = game;
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  return (
    <div className="app">
      <div ref={containerRef} className="game-canvas" />

      <div className="hud">
        {/* Objective */}
        <div className="panel top-left">
          <div className="label">MISSION</div>
          <div className="objective">{hud.objective}</div>
        </div>

        {/* Wanted level */}
        <div className={`panel top-right ${hud.wanted > 0 && hud.wantedFlash ? "wanted-flash" : ""}`}>
          <div className="label">POLICE</div>
          <div className="stars">
            {[0, 1].map((i) => (
              <span key={i} className={i < hud.wanted ? "star on" : "star"}>
                ★
              </span>
            ))}
          </div>
          {hud.wanted > 0 && <div className="wanted-text">WANTED — escape the police</div>}
        </div>

        {/* Player state */}
        <div className="panel bottom-left">
          <div className="state">{hud.mode}</div>
          {hud.mode === "DRIVING" && <div className="speed">{hud.speed} km/h</div>}
        </div>

        {/* Interaction hint */}
        {hud.hint && <div className="panel hint bottom-center">{hud.hint}</div>}

        {/* Controls */}
        <div className="panel bottom-right controls">
          <div className="label">CONTROLS</div>
          <div className="row">
            <span className="key">W A S D</span> move / drive
          </div>
          <div className="row">
            <span className="key">E</span> enter / exit
          </div>
          <div className="row">
            <span className="key">Space</span> brake
          </div>
          <div className="row">
            <span className="key">R</span> restart mission
          </div>
          <div className="row">
            <span className="key">Mouse</span> drag to orbit
          </div>
        </div>

        {/* Mission complete */}
        {hud.missionComplete && (
          <div className="mission-overlay">
            <div className="mission-box">
              <h2>Mission Complete</h2>
              <p>You delivered the car. Nice driving.</p>
              <button
                className="btn"
                onClick={() => gameRef.current?.restartMission()}
                onMouseDown={(e) => e.preventDefault()}
              >
                Replay mission (R)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
