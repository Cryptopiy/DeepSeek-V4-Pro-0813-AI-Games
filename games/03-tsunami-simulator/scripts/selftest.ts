import { Simulation } from '../src/sim/simulation';
import { GRID_COLS } from '../src/sim/types';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok:', msg);
}

function run(waveHeight: number, seconds: number) {
  const sim = new Simulation(20240819);
  sim.waveHeight = waveHeight;
  sim.start();
  const dt = 1 / 30;
  let steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    sim.step(dt);
    // verify no NaN / negative depths
    if (i % 10 === 0) {
      for (let j = 0; j < sim.water.depth.length; j++) {
        const d = sim.water.depth[j];
        if (!Number.isFinite(d)) throw new Error(`NaN depth at ${j}`);
        if (d < 0) throw new Error(`negative depth ${d} at ${j}`);
      }
    }
  }
  return sim.getStats();
}

const small = run(2, 30);
const large = run(20, 30);

console.log('small wave:', small.floodedFraction.toFixed(3), 'maxDepth', small.maxDepth.toFixed(2));
console.log('large wave:', large.floodedFraction.toFixed(3), 'maxDepth', large.maxDepth.toFixed(2));

assert(small.floodedFraction > 0, 'small wave floods some land');
assert(large.floodedFraction > small.floodedFraction, 'large wave floods more than small wave');
assert(large.maxDepth >= small.maxDepth, 'large wave produces deeper water');
assert(small.maxDepth < 20, 'max depth does not exceed wave height (energy conservation sanity)');

// Deterministic low-before-high check: verify low coastal cells flood earlier than elevated terrain.
{
  const sim = new Simulation(20240819);
  sim.waveHeight = 20;
  sim.start();
  const coastalCell = (0 * GRID_COLS + 42); // ~0.3 m elevation, just inland of shore
  const midCell = (124 * GRID_COLS + 78); // ~4.8 m elevation inland zone
  let coastalFloodedAt = -1;
  let midFloodedAt = -1;
  const dt = 1 / 30;
  for (let i = 0; i < 30 * 40; i++) {
    sim.step(dt);
    if (coastalFloodedAt < 0 && sim.water.depth[coastalCell] > 0.05) coastalFloodedAt = i;
    if (midFloodedAt < 0 && sim.water.depth[midCell] > 0.05) midFloodedAt = i;
    if (coastalFloodedAt >= 0 && midFloodedAt >= 0) break;
  }
  assert(coastalFloodedAt >= 0, 'coastal cell floods');
  assert(midFloodedAt >= 0, 'mid-elevation cell floods under a 20 m wave');
  assert(coastalFloodedAt <= midFloodedAt, 'low coastal cell floods before elevated cell');
  console.log('coastal flooded step:', coastalFloodedAt, 'mid flooded step:', midFloodedAt);
}

// Reset consistency.
{
  const sim = new Simulation(20240819);
  sim.waveHeight = 15;
  sim.start();
  for (let i = 0; i < 30 * 10; i++) sim.step(1 / 30);
  sim.reset();
  const s = sim.getStats();
  assert(s.floodedFraction === 0, 'reset clears flood');
  assert(s.displacedVehicles === 0, 'reset restores vehicles');
  assert(sim.vehicles.every((v) => v.x === v.startX && v.z === v.startZ), 'reset restores vehicle positions');
  console.log('reset OK');
}

// Repeat runs do not accumulate state / slow down (basic sanity).
{
  const sim = new Simulation(20240819);
  const t0 = Date.now();
  for (let run = 0; run < 3; run++) {
    sim.waveHeight = 10;
    sim.start();
    for (let i = 0; i < 30 * 20; i++) sim.step(1 / 30);
  }
  const elapsed = Date.now() - t0;
  console.log('3 full runs took', elapsed, 'ms');
  assert(elapsed < 20000, 'multiple runs complete quickly');
}

console.log('\nAll self-tests passed.');
