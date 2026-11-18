import { useMemo } from 'react';
import * as THREE from 'three';

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d')! };
}

function makeRunwayTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(2400, 240);
  ctx.fillStyle = '#34383e';
  ctx.fillRect(0, 0, 2400, 240);

  // edge lines
  ctx.strokeStyle = '#d9dde2';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(2400, 12);
  ctx.moveTo(0, 228);
  ctx.lineTo(2400, 228);
  ctx.stroke();

  // dashed centre line
  ctx.strokeStyle = '#e8ebef';
  ctx.lineWidth = 6;
  ctx.setLineDash([70, 50]);
  ctx.beginPath();
  ctx.moveTo(0, 120);
  ctx.lineTo(2400, 120);
  ctx.stroke();
  ctx.setLineDash([]);

  // ticks every 5 m (20 px per metre)
  for (let x = 0; x <= 2400; x += 100) {
    const major = (x / 100) % 2 === 0;
    ctx.strokeStyle = major ? '#ffffff' : '#8a9099';
    ctx.lineWidth = major ? 6 : 3;
    const inset = major ? 14 : 30;
    ctx.beginPath();
    ctx.moveTo(x, inset);
    ctx.lineTo(x, 240 - inset);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeRulerTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(2400, 160);
  ctx.fillStyle = '#15171b';
  ctx.fillRect(0, 0, 2400, 160);

  // alternating 5 m bands (40 px = 5 m)
  for (let x = 0; x < 2400; x += 100) {
    const band = (x / 100) % 2 === 0;
    ctx.fillStyle = band ? '#2f333a' : '#1d2025';
    ctx.fillRect(x, 0, 100, 160);
  }

  // numbers every 10 m, x_world = -40 .. +80
  ctx.fillStyle = '#f0f2f5';
  ctx.font = 'bold 44px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let m = -40; m <= 80; m += 10) {
    const px = (m + 40) * 20; // 20 px per metre
    ctx.fillText(`${m}`, px, 80);
  }
  // "m" label
  ctx.font = 'bold 30px monospace';
  ctx.fillText('m', 40, 80);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function Track() {
  const runwayTex = useMemo(makeRunwayTexture, []);
  const rulerTex = useMemo(makeRulerTexture, []);

  return (
    <group>
      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#1b1d21" roughness={0.95} />
      </mesh>

      {/* runway */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[20, 0, 0]} receiveShadow>
        <planeGeometry args={[120, 12]} />
        <meshStandardMaterial map={runwayTex} roughness={0.9} />
      </mesh>

      {/* distance ruler (readable from the default +Z camera side) */}
      <mesh position={[20, 0.26, -6.6]}>
        <planeGeometry args={[120, 0.55]} />
        <meshStandardMaterial map={rulerTex} roughness={0.8} />
      </mesh>

      {/* impact zone */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <planeGeometry args={[6, 15]} />
        <meshStandardMaterial
          color="#f2c230"
          transparent
          opacity={0.18}
          roughness={1}
          depthWrite={false}
        />
      </mesh>
      <ImpactBorder />
    </group>
  );
}

function ImpactBorder() {
  const mat = <meshStandardMaterial color="#f2c230" emissive="#f2c230" emissiveIntensity={0.4} />;
  const L = 6;
  const W = 15;
  return (
    <group position={[0, 0.02, 0]}>
      <mesh position={[0, 0, -W / 2]}>{mat}<boxGeometry args={[L, 0.02, 0.12]} /></mesh>
      <mesh position={[0, 0, W / 2]}>{mat}<boxGeometry args={[L, 0.02, 0.12]} /></mesh>
      <mesh position={[-L / 2, 0, 0]}>{mat}<boxGeometry args={[0.12, 0.02, W]} /></mesh>
      <mesh position={[L / 2, 0, 0]}>{mat}<boxGeometry args={[0.12, 0.02, W]} /></mesh>
    </group>
  );
}
