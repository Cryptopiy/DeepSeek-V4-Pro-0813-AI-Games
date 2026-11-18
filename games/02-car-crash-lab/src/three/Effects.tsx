import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEngine } from './engineContext';

const DEBRIS_POOL = 60;
const SPARK_POOL = 80;
const SKID_POOL = 600;

export function Debris() {
  const engine = useEngine();
  const pool = useMemo(() => {
    const g = new THREE.Group();
    for (let i = 0; i < DEBRIS_POOL; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.14, 0.14),
        new THREE.MeshStandardMaterial({ color: '#c62828', roughness: 0.7 }),
      );
      m.visible = false;
      m.castShadow = true;
      g.add(m);
    }
    return g;
  }, []);

  useFrame(() => {
    const d = engine.debris;
    for (let i = 0; i < DEBRIS_POOL; i++) {
      const mesh = pool.children[i] as THREE.Mesh;
      const p = d[i];
      if (p) {
        mesh.visible = true;
        mesh.position.set(p.x, p.y, p.z);
        mesh.rotation.set(p.rotX, p.rotZ, 0);
        (mesh.material as THREE.MeshStandardMaterial).color.set(p.color);
        mesh.scale.setScalar(p.size / 0.14);
      } else {
        mesh.visible = false;
      }
    }
  });

  return <primitive object={pool} />;
}

export function Sparks() {
  const engine = useEngine();
  const pool = useMemo(() => {
    const g = new THREE.Group();
    for (let i = 0; i < SPARK_POOL; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 6, 6),
        new THREE.MeshBasicMaterial({ color: '#ffd54f' }),
      );
      m.visible = false;
      g.add(m);
    }
    return g;
  }, []);

  useFrame(() => {
    const s = engine.sparks;
    for (let i = 0; i < SPARK_POOL; i++) {
      const mesh = pool.children[i] as THREE.Mesh;
      const p = s[i];
      if (p) {
        mesh.visible = true;
        mesh.position.set(p.x, p.y, p.z);
        const k = Math.max(0, p.life / p.maxLife);
        (mesh.material as THREE.MeshBasicMaterial).color.set(
          k > 0.5 ? '#ffd54f' : '#ff8f00',
        );
        mesh.scale.setScalar(0.5 + k);
      } else {
        mesh.visible = false;
      }
    }
  });

  return <primitive object={pool} />;
}

export function Skids() {
  const engine = useEngine();
  const pool = useMemo(() => {
    const g = new THREE.Group();
    for (let i = 0; i < SKID_POOL; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          color: '#0b0b0d',
          transparent: true,
          depthWrite: false,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      g.add(m);
    }
    return g;
  }, []);

  useFrame(() => {
    const s = engine.skids;
    for (let i = 0; i < SKID_POOL; i++) {
      const mesh = pool.children[i] as THREE.Mesh;
      const p = s[i];
      if (p) {
        mesh.visible = true;
        mesh.position.set(p.x, 0.03, p.z);
        mesh.rotation.y = -p.angle;
        mesh.scale.set(p.length, p.width, 1);
        (mesh.material as THREE.MeshBasicMaterial).opacity = p.alpha;
      } else {
        mesh.visible = false;
      }
    }
  });

  return <primitive object={pool} />;
}
