import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEngine } from './engineContext';

// Perspective camera that follows the car through the approach, pulls back at
// impact, then frames the final resting position. Adds screen shake on impact.
export function CameraRig() {
  const engine = useEngine();
  const look = useRef(new THREE.Vector3(-10, 0, 0));

  useFrame((state, delta) => {
    const cam = state.camera as THREE.PerspectiveCamera;
    const c = engine.car;

    const targetPos = new THREE.Vector3();
    const targetLook = new THREE.Vector3();

    if (engine.phase === 'idle') {
      targetPos.set(-16, 9, 18);
      targetLook.set(-10, 0, 0);
    } else if (!engine.impacted) {
      // approach: follow the car from behind-left-above
      targetPos.set(c.pos.x - 11, 7, c.pos.z + 12);
      targetLook.set(c.pos.x + 2, 0, 0);
    } else if (engine.phase === 'running') {
      // post-impact: keep following but pull back for a wider view
      targetPos.set(c.pos.x - 12, 8, c.pos.z + 14);
      targetLook.set(c.pos.x, 0, c.pos.z);
    } else {
      // settled: overview of the resting position
      targetPos.set(c.pos.x * 0.4, 11, 19);
      targetLook.set(c.pos.x * 0.5, 0, c.pos.z * 0.4);
    }

    const k = 1 - Math.exp(-3.5 * delta);
    cam.position.lerp(targetPos, k);
    look.current.lerp(targetLook, k);
    cam.lookAt(look.current);

    if (engine.shake > 0.001) {
      const s = engine.shake;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.position.z += (Math.random() - 0.5) * s;
    }
  });

  return null;
}
