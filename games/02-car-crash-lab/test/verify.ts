import { CrashEngine } from '../src/physics/engine';

function run(label: string, cfg: Partial<Parameters<CrashEngine['configure']>[0]>) {
  const e = new CrashEngine();
  const base = {
    speedKmh: 100,
    massKg: 1500,
    angleDeg: 0,
    obstacle: 'concrete-wall' as const,
  };
  e.configure({ ...base, ...cfg });
  e.run();
  let settled = false;
  let result: ReturnType<CrashEngine['onSettle']> = null as any;
  e.onSettle = (r) => {
    settled = true;
    result = r as any;
  };
  const dt = 1 / 240;
  let guard = 0;
  while (!settled && guard < 240 * 20) {
    e.frame(dt);
    guard++;
  }
  if (!result) {
    console.log(label, '-> FAILED TO SETTLE');
    return;
  }
  console.log(
    label,
    '| impact', result.speedImpactKmh.toFixed(1), 'km/h',
    '| force', (result.impactForceN / 1000).toFixed(0), 'kN',
    '| dmg', result.damagePct.toFixed(1) + '%',
    '| zone', result.impactZone,
    '| final', result.finalX.toFixed(1), result.finalZ.toFixed(1),
    '| yaw', result.finalYawDeg.toFixed(1),
  );
}

// determinism check: same config twice
const a = new CrashEngine();
const b = new CrashEngine();
a.configure({ speedKmh: 120, massKg: 1500, angleDeg: 20, obstacle: 'heavy-barrier' });
b.configure({ speedKmh: 120, massKg: 1500, angleDeg: 20, obstacle: 'heavy-barrier' });
a.run();
b.run();
let ra: any = null;
let rb: any = null;
a.onSettle = (r) => (ra = r as any);
b.onSettle = (r) => (rb = r as any);
let g = 0;
while ((!ra || !rb) && g < 240 * 20) {
  a.frame(1 / 240);
  b.frame(1 / 240);
  g++;
}
console.log(
  'determinism:',
  ra && rb && ra.finalX.toFixed(6) === rb.finalX.toFixed(6)
    ? 'IDENTICAL finalX'
    : `DIFFER (${ra?.finalX.toFixed(6)} vs ${rb?.finalX.toFixed(6)})`,
);

run('wall 100km/h 0deg    ', {});
run('wall 50km/h 0deg     ', { speedKmh: 50 });
run('wall 200km/h 0deg    ', { speedKmh: 200 });
run('wall 100km/h 60deg   ', { angleDeg: 60 });
run('heavy 100km/h 0deg   ', { obstacle: 'heavy-barrier' });
run('light 100km/h 0deg   ', { obstacle: 'light-barrier' });
run('light 100km/h 60deg  ', { obstacle: 'light-barrier', angleDeg: 60 });
run('wall 100km/h 3000kg  ', { massKg: 3000 });
run('wall 10km/h 0deg     ', { speedKmh: 10 });
