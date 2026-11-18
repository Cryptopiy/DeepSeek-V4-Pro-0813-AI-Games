import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Simulation } from '../sim/simulation';
import { Terrain, Water } from './Terrain';
import { Buildings, Vehicles, People } from './Objects';

function SimulationLoop({ sim }: { sim: Simulation }) {
  const timeRef = useRef(0);
  const last = useRef(performance.now());

  useFrame(() => {
    const now = performance.now();
    const dt = (now - last.current) / 1000;
    last.current = now;
    timeRef.current += dt;
    sim.step(dt);
  });

  return <Water sim={sim} timeRef={timeRef} />;
}

export function SimScene({ sim }: { sim: Simulation }) {
  return (
    <Canvas
      shadows
      camera={{ position: [110, 70, 150], fov: 55, near: 0.5, far: 800 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#87b5d9']} />
      <fog attach="fog" args={['#87b5d9', 120, 520]} />

      <hemisphereLight args={['#cfe8ff', '#3a4a3a', 0.75]} />
      <directionalLight
        position={[80, 120, 60]}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-140}
        shadow-camera-right={140}
        shadow-camera-top={140}
        shadow-camera-bottom={-140}
        shadow-camera-near={1}
        shadow-camera-far={400}
        shadow-bias={-0.0004}
      />

      <Terrain sim={sim} />
      <SimulationLoop sim={sim} />
      <Buildings sim={sim} />
      <Vehicles sim={sim} />
      <People sim={sim} />

      {/* Sea surface extending beyond the grid for visual depth */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-130, 0, 0]}>
        <planeGeometry args={[100, 300]} />
        <meshStandardMaterial color="#2b6f9e" roughness={0.25} metalness={0.1} />
      </mesh>

      <OrbitControls
        makeDefault
        target={[60, 0, 0]}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={30}
        maxDistance={320}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}
