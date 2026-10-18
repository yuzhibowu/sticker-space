import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DEFAULT_COMP, FREEFORM_COMP, applyToImageData, solveWritten, forwardOf } from './colorCorrection/color';
import { addExtents, packUsdz } from './usdzExtent';
import { unzipSync, strToU8 } from 'fflate';

describe('几棱体原样复用和导出隔离', () => {
  it('三个实测 JSON 档与源项目逐字节一致', () => {
    // 从原项目读取后记录校验值，测试不依赖开发者机器上的其他项目目录。
    const hashes: Record<string, string> = {
      'keynote-prism-dense': '4e412ac5618feb26618deb5accdfc56edd1449a880eb8ef2350533508c5a1129',
      'keynote-card-dense': '71b162532d98e630a803088594a94252dc18b3d83eee549951c05a00e46e4648',
      'freeform-prism-dense': '3c74885a2fa7b4756658e54cf787942511cc9527b08fa6e611622d4f2de5af1c',
    };
    for (const name of Object.keys(hashes)) {
      const copy = readFileSync(new URL(`./colorCorrection/profiles/${name}.json`, import.meta.url));
      expect(createHash('sha256').update(copy).digest('hex')).toBe(hashes[name]);
    }
  });
  it('App 使用各自实测补光，不共享同一颜色校正参数', () => {
    expect(DEFAULT_COMP.calibratedLift).toBe(0.5); expect(FREEFORM_COMP.calibratedLift).toBe(0);
    expect(DEFAULT_COMP.samples!.length).toBeGreaterThan(1100);
    expect(FREEFORM_COMP.samples!.length).toBeGreaterThan(1100);
  });
  it('关闭补偿严格原样；Alpha 始终保留；源数组不受导出副本改写', () => {
    const original = new Uint8ClampedArray([180, 35, 35, 0, 40, 120, 210, 128, 255, 255, 255, 255]);
    const copy = original.slice(); applyToImageData(copy, { ...DEFAULT_COMP, on: false }); expect(copy).toEqual(original);
    const auto = original.slice(); applyToImageData(auto, FREEFORM_COMP);
    expect([auto[3], auto[7], auto[11]]).toEqual([0, 128, 255]);
    expect(original[0]).toBe(180); expect(auto).not.toEqual(original);
  }, 30000);
  it('原求解器可校正中间色；域外颜色诚实保留无法达到的误差', () => {
    const goal = [100, 100, 100]; const written = solveWritten(...goal as [number, number, number], FREEFORM_COMP);
    const predicted = forwardOf(...written, FREEFORM_COMP);
    expect(Math.max(...predicted.map((v, i) => Math.abs(v - goal[i])))).toBeLessThan(4);
  }, 30000);
  it('USDZ 包无压缩、64 字节对齐、带几何 extent', () => {
    const text = addExtents('def Mesh "test" {\n point3f[] points = [(-1, 0, 2), (3, 4, -2)]\n}');
    expect(text).toContain('extent = [(-1, 0, -2), (3, 4, 2)]');
    const bytes = packUsdz({ 'model.usda': strToU8(text), 'textures/test.png': new Uint8Array(257) });
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 0, count = 0;
    while (view.getUint32(offset, true) === 0x04034b50) {
      expect(view.getUint16(offset + 8, true)).toBe(0);
      const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
      expect(start % 64).toBe(0); count++;
      offset = start + view.getUint32(offset + 18, true);
    }
    expect(count).toBe(2); expect(Object.keys(unzipSync(bytes))).toHaveLength(2);
  });
});
