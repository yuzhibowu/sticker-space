import { describe, expect, it, vi, afterEach } from 'vitest';
import { historyReducer } from './StickerManager';
import { transformSticker } from './editing';
import { parseProject } from './project';
import { ResourcePool } from './ResourcePool';
import { POLE, type StickerSceneData, type StickerData } from './types';

const sticker: StickerData = { id: 'one', surfaceId: POLE.id, assetId: 'png', position: [0, 0, POLE.radius], normal: [0, 0, 1], rotation: [0, 0, 0], scale: [0.8, 0.4], method: 'conform', order: 0, placedAt: 20 };
const scene: StickerSceneData = { version: 1, surface: POLE, assets: [{ id: 'png', name: '测试', image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ', width: 1, height: 1 }], stickers: [sticker] };

describe('工程编辑和误操作恢复', () => {
  it('清空、删除和打开其他工程均可恢复完整作品，素材引用不复制', () => {
    for (const action of [{ type: 'clear' as const }, { type: 'remove' as const, id: 'one' }, { type: 'replace' as const, scene: { ...scene, stickers: [] } }]) {
      const changed = historyReducer(scene, action), undone = historyReducer(changed, { type: 'undo' });
      expect(undone.present).toBe(scene); expect(undone.present.assets).toBe(scene.assets);
      expect(historyReducer(undone, { type: 'redo' }).present.stickers).toHaveLength(0);
    }
  });
  it('一个连续手势只撤销一次，新操作清空重做', () => {
    let history = historyReducer(scene, { type: 'update', sticker: transformSticker(sticker, POLE, { width: 1 }), group: 'width' });
    history = historyReducer(history, { type: 'update', sticker: transformSticker(sticker, POLE, { width: 1.5 }), group: 'width' });
    expect(history.past).toHaveLength(1);
    history = historyReducer(history, { type: 'undo' }); expect(history.present.stickers[0].scale[0]).toBe(0.8);
    expect(historyReducer(history, { type: 'place', sticker: { ...sticker, id: 'new' } }).future).toHaveLength(0);
  });
  it('移动、旋转和缩放继续贴在圆柱上，并约束模型上下边缘', () => {
    const edited = transformSticker(sticker, POLE, { angle: Math.PI * 0.75, y: 50, roll: Math.PI / 2, width: 2 });
    expect(Math.hypot(edited.position[0], edited.position[2])).toBeCloseTo(POLE.radius);
    expect(Math.hypot(...edited.normal)).toBeCloseTo(1);
    expect(edited.position[1] + edited.scale[0] / 2).toBeLessThan(POLE.height / 2);
    expect(edited.id).toBe(sticker.id); expect(edited.order).toBe(sticker.order); expect(edited.placedAt).toBe(sticker.placedAt);
    expect(transformSticker(sticker, POLE, { width: 0.2 }).method).toBe('decal');
  });
  it('旧工程仍可打开；损坏、缺素材和非有限坐标整份拒绝', () => {
    expect(parseProject(scene)).toEqual(scene);
    expect(() => parseProject({ ...scene, version: 9 })).toThrow();
    expect(() => parseProject({ ...scene, assets: [] })).toThrow();
    expect(() => parseProject({ ...scene, stickers: [{ ...sticker, position: [NaN, 0, 1] }] })).toThrow();
    expect(() => parseProject({ ...scene, stickers: [{ ...sticker, assetId: 'missing' }] })).toThrow();
    expect(() => parseProject({ ...scene, stickers: [{ ...sticker, position: [0, 0, 100] }] })).toThrow();
  });
  it('撤销贴纸编辑不把摄像机带回旧视角', () => {
    let history = historyReducer(scene, { type: 'clear' });
    const view = { position: [3, 1, 7] as [number, number, number], target: [0, 0, 0] as [number, number, number] };
    history = historyReducer(history, { type: 'view', view });
    expect(historyReducer(history, { type: 'undo' }).present.view).toBe(view);
  });
  it('细长贴纸转为横向后使用曲面展开，避免只按原始宽度选择平面投影', () => {
    const tall = { ...sticker, scale: [0.2, 2] as [number, number], method: 'decal' as const };
    expect(transformSticker(tall, POLE, { roll: Math.PI / 2 }).method).toBe('conform');
  });
});

describe('共享素材资源回收', () => {
  afterEach(() => vi.useRealTimers());
  it('重复贴纸只加载一次，最后一个使用者释放后才回收', async () => {
    vi.useFakeTimers(); const resource = {}, load = vi.fn(async () => resource), dispose = vi.fn();
    const pool = new ResourcePool(load, dispose), a = vi.fn(), b = vi.fn();
    const releaseA = pool.acquire('same', a), releaseB = pool.acquire('same', b);
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(1); expect(a).toHaveBeenLastCalledWith(resource); expect(b).toHaveBeenLastCalledWith(resource);
    releaseA(); await vi.advanceTimersByTimeAsync(250); expect(dispose).not.toHaveBeenCalled();
    releaseB(); await vi.advanceTimersByTimeAsync(250); expect(dispose).toHaveBeenCalledTimes(1); expect(pool.stats.loaded).toBe(0);
  });
  it('全部卸载后才完成加载的资源也会回收', async () => {
    vi.useFakeTimers(); let resolve!: (value: object) => void; const dispose = vi.fn();
    const pool = new ResourcePool(() => new Promise<object>(r => { resolve = r; }), dispose);
    pool.acquire('late', () => {})(); await vi.advanceTimersByTimeAsync(250);
    const resource = {}; resolve(resource); await vi.advanceTimersByTimeAsync(0);
    expect(dispose).toHaveBeenCalledWith(resource); expect(pool.stats.users).toBe(0);
  });
});
