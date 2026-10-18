import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Spherical, Vector3 } from 'three';
import { createRequire } from 'node:module';
import { clearOrbitDamping } from './orbitDamping';
import { stepKeyboardOrbit, type OrbitKey } from './keyboardOrbit';
// Use the same controller version that Drei loads, independent of package layout.
const require = createRequire(import.meta.url);
const { OrbitControls } = createRequire(require.resolve('@react-three/drei'))('three-stdlib');

describe('keyboard takeover of drag inertia', () => {
  it('reproduces the extra horizontal movement caused by leftover drag damping', () => {
    const camera = new PerspectiveCamera(); camera.position.set(0,0,8);
    const control = new OrbitControls(camera); control.enableDamping = true;
    control.setAzimuthalAngle(.8);
    const angle = control.getAzimuthalAngle(); control.update();
    expect(control.getAzimuthalAngle()-angle).toBeGreaterThan(.03);
    control.dispose();
  });
  it.each(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] as OrbitKey[])('keeps %s at a constant angular speed after a damped drag', key => {
    const camera = new PerspectiveCamera(); camera.position.set(0, 0, 8);
    const control = new OrbitControls(camera); control.enableDamping = true;
    control.setAzimuthalAngle(.8); // Leaves actual OrbitControls horizontal inertia.
    const before = camera.position.clone();
    clearOrbitDamping(control);
    expect(camera.position.distanceTo(before)).toBeLessThan(1e-12);
    const held = new Set<OrbitKey>([key]), offset = new Vector3(), spherical = new Spherical();
    let velocity = { x: 0, y: 0 };
    for (let i = 0; i < 30; i++) {
      spherical.setFromVector3(offset.copy(camera.position).sub(control.target));
      const previous = { theta: spherical.theta, phi: spherical.phi };
      const next = stepKeyboardOrbit(held, velocity, 1 / 60); velocity = next.velocity;
      spherical.theta += next.delta.x; spherical.phi += next.delta.y;
      camera.position.copy(control.target).add(offset.setFromSpherical(spherical)); control.update();
      expect(control.getAzimuthalAngle() - previous.theta).toBeCloseTo(next.delta.x, 12);
      expect(control.getPolarAngle() - previous.phi).toBeCloseTo(next.delta.y, 12);
    }
    expect(control.enableDamping).toBe(true); control.dispose();
  });
});
