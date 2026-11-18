import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Simulation } from '../sim/simulation';
import { bilinearDepth, sampleElevation } from '../sim/terrain';

export function Buildings({ sim }: { sim: Simulation }) {
  const group = useRef<THREE.Group>(null);
  const materials = useMemo(() => {
    return sim.buildings.map((b) => {
      const wall = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.8 });
      const roof = new THREE.MeshStandardMaterial({ color: b.roofColor, roughness: 0.9 });
      return { wall, roof };
    });
  }, [sim]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    sim.buildings.forEach((b, idx) => {
      const mat = materials[idx];
      if (b.damaged && mat.wall.color.getHexString() !== '5a4a3a') {
        mat.wall.color.set('#5a4a3a');
        mat.roof.color.set('#3a3028');
      } else if (!b.damaged && mat.wall.color.getHexString() === '5a4a3a') {
        mat.wall.color.set(b.color);
        mat.roof.color.set(b.roofColor);
      }
    });
  });

  return (
    <group ref={group}>
      {sim.buildings.map((b) => {
        const ground = sampleElevation(sim.elevation, b.x, b.z);
        return (
          <group key={b.id} position={[b.x, ground + b.h / 2, b.z]}>
            <mesh castShadow receiveShadow material={materials[b.id].wall}>
              <boxGeometry args={[b.w, b.h, b.d]} />
            </mesh>
            <mesh
              position={[0, b.h / 2 + 0.1, 0]}
              material={materials[b.id].roof}
              castShadow
            >
              <boxGeometry args={[b.w + 0.3, 0.3, b.d + 0.3]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export function Vehicles({ sim }: { sim: Simulation }) {
  const group = useRef<THREE.Group>(null);
  const bodies = useRef<THREE.Mesh[]>([]);
  const cabins = useRef<THREE.Mesh[]>([]);
  const bodyMats = useMemo(
    () => sim.vehicles.map((v) => new THREE.MeshStandardMaterial({ color: v.color, roughness: 0.35, metalness: 0.4 })),
    [sim],
  );

  useFrame(() => {
    sim.vehicles.forEach((v, i) => {
      const body = bodies.current[i];
      if (!body) return;
      const elev = sampleElevation(sim.elevation, v.x, v.z);
      const depth = bilinearDepth(sim.water.depth, v.x, v.z);
      const buoyancy = Math.min(depth, v.h * 0.7);
      const y = elev + buoyancy;
      body.position.set(v.x, y, v.z);
      body.rotation.y = -v.heading + Math.PI / 2;
      const cabin = cabins.current[i];
      if (cabin) {
        cabin.position.set(v.x, y + v.h * 0.55, v.z);
        cabin.rotation.y = -v.heading + Math.PI / 2;
      }
    });
  });

  return (
    <group ref={group}>
      {sim.vehicles.map((v, i) => (
        <group key={v.id}>
          <mesh
            ref={(m) => {
              if (m) bodies.current[i] = m;
            }}
            material={bodyMats[i]}
            castShadow
          >
            <boxGeometry args={[v.w, v.h, v.d]} />
          </mesh>
          <mesh
            ref={(m) => {
              if (m) cabins.current[i] = m;
            }}
            material={bodyMats[i]}
            castShadow
          >
            <boxGeometry args={[v.w * 0.8, v.h * 0.5, v.d * 0.45]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function People({ sim }: { sim: Simulation }) {
  const group = useRef<THREE.Group>(null);
  const bodies = useRef<THREE.Mesh[]>([]);
  const mats = useMemo(
    () => sim.people.map((p) => new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.7 })),
    [sim],
  );

  useFrame(() => {
    sim.people.forEach((p, i) => {
      const body = bodies.current[i];
      if (!body) return;
      const elev = sampleElevation(sim.elevation, p.x, p.z);
      const depth = bilinearDepth(sim.water.depth, p.x, p.z);
      const y = elev + Math.max(0, depth - 0.2);
      body.position.set(p.x, y, p.z);
      const dir = Math.atan2(p.vz, p.vx);
      body.rotation.y = -dir + Math.PI / 2;
    });
  });

  return (
    <group ref={group}>
      {sim.people.map((p, i) => (
        <group key={p.id}>
          <mesh
            ref={(m) => {
              if (m) bodies.current[i] = m;
            }}
            material={mats[i]}
            castShadow
          >
            <capsuleGeometry args={[0.25, 1.2, 4, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
