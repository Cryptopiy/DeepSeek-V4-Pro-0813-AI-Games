import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEngine } from './engineContext';
import { ObstacleDef } from '../obstacles';

export function Obstacle() {
  const engine = useEngine();
  const group = useRef<THREE.Group>(null);
  const def = engine.obstacleDef;

  useFrame(() => {
    const o = engine.obstacle;
    if (group.current) {
      group.current.position.set(o.pos.x, 0, o.pos.z);
      group.current.rotation.y = -o.angle;
    }
  });

  return (
    <group ref={group}>
      <ObstacleMesh def={def} />
    </group>
  );
}

function ObstacleMesh({ def }: { def: ObstacleDef }) {
  const hx = def.half.x;
  const hz = def.half.z;
  const h = def.height;

  const stripeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: def.accent, roughness: 0.3, metalness: 0.2 }),
    [def.accent],
  );
  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.5, metalness: 0.1 }),
    [def.color],
  );

  return (
    <group>
      {/* Main body */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[hx * 2, h, hz * 2]} />
        <primitive object={bodyMat} attach="material" />
      </mesh>
      {/* Stripe 1 */}
      <mesh position={[0, h * 0.65, hz + 0.01]}>
        <boxGeometry args={[hx * 1.6, h * 0.06, 0.04]} />
        <primitive object={stripeMat} attach="material" />
      </mesh>
      {/* Stripe 2 */}
      <mesh position={[0, h * 0.4, hz + 0.01]}>
        <boxGeometry args={[hx * 1.6, h * 0.06, 0.04]} />
        <primitive object={stripeMat} attach="material" />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[hx * 2 + 0.2, 0.16, hz * 2 + 0.2]} />
        <meshStandardMaterial color="#333" roughness={0.8} />
      </mesh>
    </group>
  );
}