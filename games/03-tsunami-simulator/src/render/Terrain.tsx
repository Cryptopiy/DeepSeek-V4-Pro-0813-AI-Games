import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Simulation } from '../sim/simulation';
import { buildGridGeometry, colorizeTerrain, updateTerrainHeights, updateWaterSurface } from './geometry';

export function Terrain({ sim }: { sim: Simulation }) {
  const { geometry } = useMemo(() => {
    const g = buildGridGeometry();
    colorizeTerrain(sim, g.geometry);
    updateTerrainHeights(sim, g.geometry);
    return g;
  }, [sim]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0.05} />
    </mesh>
  );
}

export function Water({ sim, timeRef }: { sim: Simulation; timeRef: { current: number } }) {
  const { geometry } = useMemo(() => buildGridGeometry(), []);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  useFrame(() => {
    updateWaterSurface(sim, geometry);
    const mat = materialRef.current;
    if (mat) (mat.uniforms.uTime as { value: number }).value = timeRef.current;
  });

  return (
    <mesh geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={WATER_VERT}
        fragmentShader={WATER_FRAG}
        vertexColors
      />
    </mesh>
  );
}

const WATER_VERT = /* glsl */ `
varying vec3 vColor;
varying float vHeight;
uniform float uTime;
void main() {
  vColor = color;
  vec3 p = position;
  // gentle surface ripple (visual only)
  float ripple = sin(p.x * 0.8 + uTime * 2.2) * 0.06 + cos(p.z * 0.7 + uTime * 1.8) * 0.06;
  p.y += ripple;
  vHeight = p.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const WATER_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vHeight;
uniform float uTime;
void main() {
  float sparkle = 0.85 + 0.15 * sin(vHeight * 3.0 + uTime * 4.0);
  gl_FragColor = vec4(vColor * sparkle, 0.72);
}
`;
