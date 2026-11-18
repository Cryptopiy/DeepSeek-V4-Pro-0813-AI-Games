// Procedural 3D models built from primitives. Everything is self-contained.

import * as THREE from "three";

export interface CarModel {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  lightBar: THREE.Object3D | null;
}

function standardMat(color: number, roughness = 0.8, metalness = 0.05): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export function createBuilding(width: number, depth: number, height: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    standardMat(color, 0.85),
  );
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // Roof slab
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.3, 0.25, depth + 0.3),
    standardMat(0x4e5a63, 0.9),
  );
  roof.position.y = height + 0.125;
  roof.castShadow = true;
  g.add(roof);

  // Window strips for readability
  const winMat = standardMat(0x37474f, 0.3, 0.6);
  for (let i = 0; i < 4; i++) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(width - 2, 1.2, 0.1), winMat);
    const y = 2 + i * 2.4;
    if (y < height - 1.5) {
      win.position.set(0, y, depth / 2 + 0.06);
      g.add(win);
    }
  }

  return g;
}

export function createCar(bodyColor: number, police = false): CarModel {
  const group = new THREE.Group();
  const bodyMat = standardMat(bodyColor, 0.35, 0.5);

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.2), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.0), standardMat(police ? 0xe8edf4 : 0x22262c, 0.3, 0.2));
  cabin.position.y = 1.05;
  cabin.position.z = -0.2;
  cabin.castShadow = true;
  group.add(cabin);

  if (police) {
    // White doors
    const doorL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 2.0), standardMat(0xeef2f7, 0.3, 0.2));
    doorL.position.set(-0.9, 0.55, 0);
    group.add(doorL);
    const doorR = doorL.clone();
    doorR.position.x = 0.9;
    group.add(doorR);
  }

  const wheels: THREE.Object3D[] = [];
  const wheelMat = standardMat(0x15171a, 0.6);
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 12);
  for (const sx of [-0.78, 0.78]) {
    for (const sz of [-1.35, 1.35]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(sx, 0.34, sz);
      w.castShadow = true;
      group.add(w);
      wheels.push(w);
    }
  }

  // Headlights / taillights
  const headMat = standardMat(0xfff7cc, 0.2, 0.1);
  const tailMat = standardMat(0xef5350, 0.2, 0.1);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.1), headMat);
  head.position.set(0, 0.6, 2.12);
  group.add(head);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.1), tailMat);
  tail.position.set(0, 0.6, -2.12);
  group.add(tail);

  let lightBar: THREE.Object3D | null = null;
  if (police) {
    lightBar = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 0.4), standardMat(0x111111, 0.3));
    bar.position.y = 1.36;
    lightBar.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.24, 0.42), standardMat(0xff2b2b, 0.3, 0.1));
    red.position.set(-0.35, 1.36, 0);
    lightBar.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.24, 0.42), standardMat(0x2b6bff, 0.3, 0.1));
    blue.position.set(0.35, 1.36, 0);
    lightBar.add(blue);
    group.add(lightBar);
  }

  return { group, wheels, lightBar };
}

export function createCharacter(bodyColor: number, isPlayer = false): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = standardMat(bodyColor, 0.8);

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.34), standardMat(0x37474f, 0.8));
  legs.position.y = 0.35;
  g.add(legs);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.4), bodyMat);
  torso.position.y = 1.0;
  torso.castShadow = true;
  g.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), standardMat(isPlayer ? 0xffd9b3 : 0xffcc99, 0.6));
  head.position.y = 1.5;
  head.castShadow = true;
  g.add(head);

  // Facing indicator (visor / nose) pointing toward +Z local.
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.18), standardMat(isPlayer ? 0x0d47a1 : 0x222222, 0.4));
  nose.position.set(0, 1.48, 0.26);
  g.add(nose);

  if (isPlayer) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.05, 8, 20),
      standardMat(0x28b6f6, 0.4, 0.2),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.06;
    g.add(ring);
  }

  return g;
}

export function createTree(): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 8), standardMat(0x6d4c41, 0.9));
  trunk.position.y = 0.8;
  trunk.castShadow = true;
  g.add(trunk);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.95, 10, 8), standardMat(0x3e7d32, 0.85));
  leaf.position.y = 2.1;
  leaf.castShadow = true;
  g.add(leaf);
  return g;
}

export function createLampPost(): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.4, 8), standardMat(0x37474f, 0.6, 0.4));
  pole.position.y = 2.2;
  pole.castShadow = true;
  g.add(pole);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), standardMat(0xfff3c4, 0.3, 0.1));
  lamp.position.y = 4.35;
  g.add(lamp);
  return g;
}

export function createMarker(color: number): THREE.Group {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 6, 16, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  beam.position.y = 3;
  g.add(beam);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.12, 10, 24),
    new THREE.MeshBasicMaterial({ color }),
  );
  ring.position.y = 0.8;
  g.add(ring);

  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 0.9, 4),
    new THREE.MeshBasicMaterial({ color }),
  );
  arrow.position.y = 1.9;
  g.add(arrow);

  return g;
}

export function createRestrictedZone(width: number, depth: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.06;
  return m;
}
