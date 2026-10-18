import { describe, expect, it } from 'vitest';
import { stepKeyboardOrbit, type OrbitKey } from './keyboardOrbit';

describe('keyboard orbit', () => {
  it('continues while held without depending on OS key repeats', () => {
    const held = new Set<OrbitKey>(['ArrowRight']);
    let velocity = { x: 0, y: 0 }, angle = 0;
    for (let frame = 0; frame < 60; frame++) {
      const next = stepKeyboardOrbit(held, velocity, 1 / 60);
      velocity = next.velocity; angle += next.delta.x;
    }
    expect(angle).toBeCloseTo(-1.25);
  });
  it('a tap produces movement followed by decreasing steps and settles', () => {
    let { velocity } = stepKeyboardOrbit(new Set<OrbitKey>(['ArrowUp']), { x: 0, y: 0 }, 1 / 60);
    const steps: number[] = [];
    for (let frame = 0; frame < 90; frame++) {
      const next = stepKeyboardOrbit(new Set(), velocity, 1 / 60);
      steps.push(next.delta.y); velocity = next.velocity;
    }
    expect(steps[0]).toBeGreaterThan(0);
    expect(steps.every((step, i) => i === 0 || step < steps[i - 1])).toBe(true);
    expect(velocity.y).toBeLessThan(0.00001);
  });
  it('release motion is independent of frame rate', () => {
    const simulate = (fps: number) => {
      let velocity = { x: 1.25, y: 0 }, angle = 0;
      for (let i = 0; i < fps; i++) {
        const next = stepKeyboardOrbit(new Set(), velocity, 1 / fps);
        angle += next.delta.x; velocity = next.velocity;
      }
      return angle;
    };
    expect(simulate(30)).toBeCloseTo(simulate(144), 12);
  });
  it('keeps diagonal speed constant and cancels opposing keys', () => {
    const diagonal = stepKeyboardOrbit(new Set<OrbitKey>(['ArrowRight', 'ArrowUp']), { x: 0, y: 0 }, 1);
    expect(Math.hypot(diagonal.delta.x, diagonal.delta.y)).toBeCloseTo(1.25);
    expect(stepKeyboardOrbit(new Set<OrbitKey>(['ArrowRight', 'ArrowLeft']), diagonal.velocity, 1).delta).toEqual({ x: 0, y: 0 });
  });
});
