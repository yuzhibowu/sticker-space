import type { Camera, Vector3 } from 'three';

type OrbitControl = { object: Camera; target: Vector3; enableDamping: boolean; update: () => unknown };

/** Discard drag inertia when another gesture takes ownership of the camera. */
export function clearOrbitDamping(control: OrbitControl) {
  const position = control.object.position.clone(), target = control.target.clone(), damping = control.enableDamping;
  control.enableDamping = false;
  control.update();
  control.object.position.copy(position); control.target.copy(target);
  control.update(); control.enableDamping = damping;
}
