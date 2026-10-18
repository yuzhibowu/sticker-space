import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { POLE, type StickerData } from './types';
import { makeStickerGeometry, orientation, stickerOffset, resolveMethod, fittedScale, clampPlacementY } from './geometry';
import { stickerPoseAtTime, frameTimes } from './timeline';
import { historyReducer } from './StickerManager';

function sticker(width: number, method: 'decal' | 'conform', angle = 0, roll = 0): StickerData {
  const normal: [number, number, number] = [Math.sin(angle), 0, Math.cos(angle)];
  return { id: 'test', surfaceId: POLE.id, assetId: 'png', position: [normal[0] * POLE.radius, 0, normal[2] * POLE.radius], normal,
    rotation: orientation(normal, roll).toArray().slice(0, 3) as [number, number, number], scale: [width, width / 2], method, order: 0, placedAt: 0 };
}
describe('曲面真实几何与投影边界', () => {
  it.each([0.25, 0.8, 1.8])('Decal 宽度 %s：有限三角形、有效 UV、保持在圆柱表面', width => {
    const geometry = makeStickerGeometry(sticker(width, 'decal'), POLE);
    const pos = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
    expect(pos.count).toBeGreaterThan(0);
    let maxRadialError = 0;
    for (let i = 0; i < pos.count; i++) {
      expect(Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i))).toBe(true);
      maxRadialError = Math.max(maxRadialError, Math.abs(Math.hypot(pos.getX(i), pos.getZ(i)) - POLE.radius - stickerOffset(0)));
      expect(uv.getX(i)).toBeGreaterThanOrEqual(-1e-6); expect(uv.getX(i)).toBeLessThanOrEqual(1.000001);
    }
    expect(maxRadialError).toBeLessThan(0.00015);
    geometry.dispose();
  });
  it('大 Decal 不等于完整绕弧贴纸：其平面投影 UV 不覆盖整张原图', () => {
    const geometry = makeStickerGeometry(sticker(1.8, 'decal'), POLE), uv = geometry.getAttribute('uv');
    const us = Array.from({ length: uv.count }, (_, i) => uv.getX(i));
    expect(Math.max(...us) - Math.min(...us)).toBeLessThan(0.65);
    geometry.dispose();
  });
  it.each([0, 1.4, 3.12, -3.12])('Conform 跨角度 %s 和 37° 旋转时完整 UV、固定半径、外向绕序', angle => {
    const data = sticker(1.8, 'conform', angle, 37 * Math.PI / 180);
    const geometry = makeStickerGeometry(data, POLE), pos = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) expect(Math.hypot(pos.getX(i), pos.getZ(i))).toBeCloseTo(POLE.radius + stickerOffset(0), 6);
    expect(uv.getX(0)).toBe(0); expect(uv.getY(0)).toBe(0);
    expect(uv.getX(uv.count - 1)).toBe(1); expect(uv.getY(uv.count - 1)).toBe(1);
    const ids = geometry.index!, a = new THREE.Vector3().fromBufferAttribute(pos, ids.getX(0)), b = new THREE.Vector3().fromBufferAttribute(pos, ids.getX(1)), c = new THREE.Vector3().fromBufferAttribute(pos, ids.getX(2));
    expect(b.sub(a).cross(c.sub(a)).dot(new THREE.Vector3().fromBufferAttribute(normal, ids.getX(0)))).toBeGreaterThan(0);
    geometry.dispose();
  });
  it('重叠层是真实错层，世界旋转保留局部坐标', () => {
    const data = sticker(1.8, 'conform'), other = { ...data, order: 20 };
    const first = makeStickerGeometry(data, POLE), second = makeStickerGeometry(other, POLE);
    const local = new THREE.Vector3().fromBufferAttribute(first.getAttribute('position'), 0);
    const parent = new THREE.Group(); parent.rotation.y = Math.PI / 3; parent.updateMatrixWorld();
    expect(local.clone().applyMatrix4(parent.matrixWorld).applyMatrix4(parent.matrixWorld.clone().invert()).distanceTo(local)).toBeLessThan(1e-12);
    expect(Math.hypot(second.getAttribute('position').getX(0), second.getAttribute('position').getZ(0)) - Math.hypot(local.x, local.z)).toBeCloseTo(stickerOffset(20) - stickerOffset(0), 6);
    expect(stickerOffset(other.order)).toBeGreaterThan(stickerOffset(data.order));
    first.dispose(); second.dispose();
  });
  it('Auto 选择、极端长宽比和端部放置不越界', () => {
    expect(resolveMethod('auto', 0.25, POLE.radius)).toBe('decal');
    expect(resolveMethod('auto', 1.8, POLE.radius)).toBe('conform');
    const scale = fittedScale(2.2, 0.1, Math.PI / 4, POLE);
    const y = clampPlacementY(POLE.height / 2, scale, Math.PI / 4, POLE);
    expect(y + (scale[0] + scale[1]) / Math.sqrt(2) / 2).toBeLessThan(POLE.height / 2);
  });
});
describe('同一数据与指定时间渲染', () => {
  it('0.16 秒落贴；时间倒退可复现；30fps 六秒严格 180 帧', () => {
    expect(stickerPoseAtTime(0, 1).visible).toBe(false);
    expect(stickerPoseAtTime(1, 1).distance).toBeCloseTo(0.34);
    expect(stickerPoseAtTime(1.16, 1).complete).toBe(true);
    expect(stickerPoseAtTime(1.161, 1).complete).toBe(true);
    expect(stickerPoseAtTime(1.14, 1).scale).toBeGreaterThan(1);
    expect(stickerPoseAtTime(1.04, 1)).toEqual(stickerPoseAtTime(1.04, 1));
    expect(frameTimes(30, 6)).toHaveLength(180);
    expect(frameTimes(30, 6)[179]).toBe(179 / 30);
  });
  it('多个贴纸、撤销、清空均保留原始图像与之前数据', () => {
    const scene = { version: 1 as const, surface: POLE, assets: [{ id: 'png', name: '原图', image: 'data:image/png;base64,original', width: 800, height: 400 }], stickers: [] };
    const one = historyReducer(scene, { type: 'place', sticker: sticker(0.8, 'conform') });
    const two = historyReducer(one, { type: 'place', sticker: { ...sticker(1.8, 'conform'), id: 'second' } });
    expect(scene.stickers).toHaveLength(0); expect(two.present.stickers).toHaveLength(2);
    expect(historyReducer(two, { type: 'undo' }).present.stickers).toHaveLength(1);
    expect(historyReducer(two, { type: 'clear' }).present.assets[0].image).toBe(scene.assets[0].image);
    const json = JSON.stringify(two.present);
    expect(JSON.stringify(JSON.parse(json))).toBe(json); // -0 和 0 的几何语义相同。
  });
});
