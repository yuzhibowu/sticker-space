import * as THREE from 'three';
export const MIN_VIEW_ZOOM = .35;
export const MAX_VIEW_ZOOM = 32;

// 采用镜头放大而非穿进雕塑内部，既能看局部，也不会被近裁切面截掉皮肤。
export function zoomView(camera: THREE.PerspectiveCamera, target: THREE.Vector3, zoom: number, pointer?: THREE.Vector2, focus?: THREE.Vector3) {
  const next = THREE.MathUtils.clamp(zoom, MIN_VIEW_ZOOM, MAX_VIEW_ZOOM);
  if (next === camera.zoom) return;
  const ray = new THREE.Raycaster(), plane = new THREE.Plane();
  let anchor: THREE.Vector3 | null = null;
  if (pointer) {
    camera.updateMatrixWorld();
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), focus ?? target);
    ray.setFromCamera(pointer, camera); anchor = ray.ray.intersectPlane(plane, new THREE.Vector3());
  }
  camera.zoom = next; camera.updateProjectionMatrix();
  if (pointer && anchor) {
    ray.setFromCamera(pointer, camera);
    const after = ray.ray.intersectPlane(plane, new THREE.Vector3());
    if (after) { const shift = anchor.sub(after); camera.position.add(shift); target.add(shift); }
  }
  camera.updateMatrixWorld();
}

// 按屏幕像素平移相机和观察中心；两者使用同一个位移，朝向与放大倍率保持不变。
export function panView(camera: THREE.PerspectiveCamera, target: THREE.Vector3, dx: number, dy: number, height: number) {
  if (height <= 0) return;
  camera.updateMatrixWorld();
  const perPixel = 2 * camera.position.distanceTo(target) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / (camera.zoom * height);
  const shift = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(-dx * perPixel)
    .addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1), dy * perPixel);
  camera.position.add(shift); target.add(shift); camera.updateMatrixWorld();
}

/** Panning and pointer-focused zoom must not move the model rotation axis. */
export function centerOrbitAxis(camera: THREE.PerspectiveCamera, target: THREE.Vector3) {
 const shift = new THREE.Vector3(-target.x, 0, -target.z);
 camera.position.add(shift); target.add(shift); camera.updateMatrixWorld();
}
