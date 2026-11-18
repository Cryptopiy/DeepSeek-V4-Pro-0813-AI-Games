export function ModelInfo() {
  return (
    <section className="panel model-info">
      <h2>Simplified physics model</h2>
      <p>
        The crash is a 2-DOF rigid-body simulation in the ground plane (XZ) using
        oriented-box (OBB) collision volumes, an impulse-based collision response,
        and a fixed 240 Hz timestep for deterministic results.
      </p>
      <ul>
        <li>
          <strong>Motion:</strong> the car launches at the configured speed along a
          direction rotated by the collision angle; before impact it cruises with only
          light drag, then skids to rest under ground friction (μ ≈ 0.55) after impact.
        </li>
        <li>
          <strong>Collision response:</strong> normal impulse{' '}
          <code>J = m_eff · (1 + e) · v_n</code> plus a Coulomb friction impulse along
          the tangent. <code>m_eff</code> is the reduced mass, <code>e</code> the
          obstacle restitution, <code>v_n</code> the closing speed along the contact
          normal. Angular impulse at the contact point produces rebound, spin and
          sliding.
        </li>
        <li>
          <strong>Impact force (estimate):</strong>{' '}
          <code>F = J / Δt</code> with an assumed impact duration{' '}
          <code>Δt = 80 ms</code>.
        </li>
        <li>
          <strong>Damage:</strong>{' '}
          <code>damage = 100 · (1 − e^(−E_car / E₀))</code>, where{' '}
          <code>E_car</code> is the energy absorbed by the vehicle{' '}
          <code>(0.5·m_eff·v_n²·(1−e²) · rigidity/(rigidity+0.4))</code> and{' '}
          <code>E₀ = 140 kJ</code>. The impact zone (front/rear/left/right) is read from
          the contact normal expressed in the car's local frame.
        </li>
        <li>
          <strong>Obstacles:</strong> concrete wall (immovable, rigid), heavy barrier
          (4000 kg), light barrier (300 kg) — each with its own mass, restitution and
          rigidity, so outcomes differ visibly.
        </li>
      </ul>
    </section>
  );
}
