import { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEngine } from './engineContext';
import { Car } from './Car';
import { Obstacle } from './Obstacle';
import { Track } from './Track';
import { Debris, Sparks, Skids } from './Effects';
import { CameraRig } from './CameraRig';

function Sun() {
  const light = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    l.shadow.camera.left = -60;
    l.shadow.camera.right = 60;
    l.shadow.camera.top = 60;
    l.shadow.camera.bottom = -60;
    l.shadow.camera.near = 0.5;
    l.shadow.camera.far = 200;
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.camera.updateProjectionMatrix();
  }, []);
  return <directionalLight ref={light} position={[30, 40, 20]} intensity={1.5} castShadow />;
}

function SimLoop() {
  const engine = useEngine();
  useFrame((_, delta) => engine.frame(delta));
  return null;
}

export function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 50, position: [-16, 9, 18], near: 0.1, far: 600 }}
    >
      <color attach="background" args={['#14161a']} />
      <fog attach="fog" args={['#14161a', 120, 420]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#cfe0ff', '#3a3328', 0.5]} />
      <Sun />
      <Track />
      <Car />
      <Obstacle />
      <Debris />
      <Sparks />
      <Skids />
      <CameraRig />
      <SimLoop />
    </Canvas>
  );
}
