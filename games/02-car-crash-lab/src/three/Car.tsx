import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEngine } from './engineContext';

const BODY = new THREE.Color('#d43a2f');
const BODY_DARK = new THREE.Color('#9c2b24');
const CRUSH = new THREE.Color('#1c1c1e');
const GLASS = new THREE.Color('#22303c');
const WHEEL = new THREE.Color('#15151a');

// Wheel (a cylinder whose axle points along Z so it rolls forward).
function Wheel({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, 0.34, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[0.34, 0.34, 0.24, 20]} />
      <meshStandardMaterial color={WHEEL} roughness={0.9} />
    </mesh>
  );
}

export function Car() {
  const engine = useEngine();
  const group = useRef<THREE.Group>(null);
  const front = useRef<THREE.Mesh>(null);
  const rear = useRef<THREE.Mesh>(null);
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  const frontMat = useRef<THREE.MeshStandardMaterial>(null);
  const rearMat = useRef<THREE.MeshStandardMaterial>(null);
  const leftMat = useRef<THREE.MeshStandardMaterial>(null);
  const rightMat = useRef<THREE.MeshStandardMaterial>(null);
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    const c = engine.car;
    if (group.current) {
      group.current.position.set(c.pos.x, 0, c.pos.z);
      group.current.rotation.y = -c.angle;
    }
    const d = engine.zoneDamage;
    const tF = d.front / 100;
    const tR = d.rear / 100;
    const tL = d.left / 100;
    const tRt = d.right / 100;

    if (front.current) {
      front.current.position.x = 2.18 - 0.55 * tF;
      front.current.scale.x = 1 - 0.6 * tF;
    }
    if (rear.current) {
      rear.current.position.x = -2.16 + 0.5 * tR;
      rear.current.scale.x = 1 - 0.55 * tR;
    }
    if (left.current) left.current.position.z = -0.85 + 0.18 * tL;
    if (right.current) right.current.position.z = 0.85 - 0.18 * tRt;

    frontMat.current?.color.lerpColors(BODY_DARK, CRUSH, tF);
    rearMat.current?.color.lerpColors(BODY_DARK, CRUSH, tR);
    leftMat.current?.color.lerpColors(BODY, CRUSH, tL);
    rightMat.current?.color.lerpColors(BODY, CRUSH, tRt);
    bodyMat.current?.color.lerpColors(BODY, BODY_DARK, Math.max(tF, tL, tRt));
  });

  return (
    <group ref={group}>
      {/* main body */}
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.0, 0.5, 1.7]} />
        <meshStandardMaterial ref={bodyMat} color={BODY} roughness={0.4} metalness={0.3} />
      </mesh>
      {/* hood */}
      <mesh position={[1.55, 0.85, 0]} castShadow>
        <boxGeometry args={[1.0, 0.18, 1.55]} />
        <meshStandardMaterial color={BODY_DARK} roughness={0.4} metalness={0.3} />
      </mesh>
      {/* cabin */}
      <mesh position={[-0.2, 1.08, 0]} castShadow>
        <boxGeometry args={[2.1, 0.5, 1.5]} />
        <meshStandardMaterial color={GLASS} roughness={0.15} metalness={0.5} />
      </mesh>
      {/* windshield */}
      <mesh position={[0.92, 1.08, 0]} castShadow>
        <boxGeometry args={[0.1, 0.46, 1.36]} />
        <meshStandardMaterial color={GLASS} roughness={0.1} metalness={0.6} />
      </mesh>
      {/* front bumper (deformable) */}
      <mesh ref={front} position={[2.18, 0.5, 0]} castShadow>
        <boxGeometry args={[0.4, 0.3, 1.78]} />
        <meshStandardMaterial ref={frontMat} color={BODY_DARK} roughness={0.35} metalness={0.3} />
      </mesh>
      {/* rear bumper (deformable) */}
      <mesh ref={rear} position={[-2.16, 0.5, 0]} castShadow>
        <boxGeometry args={[0.32, 0.26, 1.78]} />
        <meshStandardMaterial ref={rearMat} color={BODY_DARK} roughness={0.35} metalness={0.3} />
      </mesh>
      {/* side panels (deformable) */}
      <mesh ref={left} position={[0, 0.62, -0.85]} castShadow>
        <boxGeometry args={[4.0, 0.3, 0.08]} />
        <meshStandardMaterial ref={leftMat} color={BODY} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh ref={right} position={[0, 0.62, 0.85]} castShadow>
        <boxGeometry args={[4.0, 0.3, 0.08]} />
        <meshStandardMaterial ref={rightMat} color={BODY} roughness={0.4} metalness={0.3} />
      </mesh>
      {/* lights */}
      <mesh position={[2.02, 0.6, -0.55]}>
        <boxGeometry args={[0.12, 0.14, 0.4]} />
        <meshStandardMaterial color="#fff7d6" emissive="#fff7d6" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[2.02, 0.6, 0.55]}>
        <boxGeometry args={[0.12, 0.14, 0.4]} />
        <meshStandardMaterial color="#fff7d6" emissive="#fff7d6" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[-2.02, 0.62, -0.55]}>
        <boxGeometry args={[0.1, 0.12, 0.34]} />
        <meshStandardMaterial color="#7a1410" emissive="#7a1410" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[-2.02, 0.62, 0.55]}>
        <boxGeometry args={[0.1, 0.12, 0.34]} />
        <meshStandardMaterial color="#7a1410" emissive="#7a1410" emissiveIntensity={0.6} />
      </mesh>
      {/* wheels */}
      <Wheel x={1.3} z={0.75} />
      <Wheel x={1.3} z={-0.75} />
      <Wheel x={-1.35} z={0.75} />
      <Wheel x={-1.35} z={-0.75} />
    </group>
  );
}
