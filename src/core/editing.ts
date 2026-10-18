import * as THREE from 'three';
import { arcFootprint, clampPlacementY, fittedScale, orientation, resolveMethod } from './geometry';
import type { StickerData, SurfaceData, Vec3 } from './types';

export function stickerRoll(data: StickerData) {
  const base = new THREE.Quaternion().setFromEuler(orientation(data.normal, 0)).invert();
  base.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...data.rotation)));
  return new THREE.Euler().setFromQuaternion(base).z;
}
/** 所有编辑仍写回 Surface 局部坐标；尺寸变化重新判断贴合方式并约束上下边缘。 */
export function transformSticker(data: StickerData, surface: SurfaceData, changes: { width?: number; roll?: number; angle?: number; y?: number }): StickerData {
  const roll = changes.roll ?? stickerRoll(data), angle = changes.angle ?? Math.atan2(data.position[0], data.position[2]);
  const scale = fittedScale(changes.width ?? data.scale[0], data.scale[0] / data.scale[1], roll, surface);
  if (surface.kind !== 'cylinder') return { ...data, scale, rotation: orientation(data.normal, roll).toArray().slice(0,3) as Vec3, method: 'conform' };
  const normal: Vec3 = [Math.sin(angle), 0, Math.cos(angle)];
  return {
    ...data, scale,
    position: [normal[0] * surface.radius, clampPlacementY(changes.y ?? data.position[1], scale, roll, surface), normal[2] * surface.radius],
    normal, rotation: orientation(normal, roll).toArray().slice(0, 3) as Vec3,
    method: resolveMethod('auto', arcFootprint(scale, roll), surface.radius),
  };
}
