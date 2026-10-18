import { describe, expect, it } from 'vitest';
import { DEFAULT_VIDEO, videoDimensions, videoFrameCount, videoRenderScale, turntableAngle } from './videoSettings';
describe('旋转视频的采样合同', () => {
  it('输出使用偶数像素，并让横竖版严格互换', () => {
    for (const resolution of [720, 1080, 1440, 2160] as const) {
      const landscape = videoDimensions({ ...DEFAULT_VIDEO, resolution, aspect: '16:9' });
      expect(videoDimensions({ ...DEFAULT_VIDEO, resolution, aspect: '9:16' })).toEqual({ width: landscape.height, height: landscape.width });
      expect(landscape.width % 2).toBe(0); expect(landscape.height % 2).toBe(0);
    }
  });
  it('所有帧唯一，循环接缝与相邻帧具有相同角度步长', () => {
    const settings = { ...DEFAULT_VIDEO, fps: 24 as const, duration: 2 }, count = videoFrameCount(settings);
    const angles = Array.from({ length: count }, (_, i) => turntableAngle(i / settings.fps, settings.duration));
    expect(new Set(angles).size).toBe(48);
    const step = Math.PI * 2 / count;
    for (let i = 1; i < angles.length; i++) expect(angles[i - 1] - angles[i]).toBeCloseTo(step, 10);
    expect(Math.PI * 2 + angles.at(-1)!).toBeCloseTo(step, 10);
    expect(turntableAngle(settings.duration, settings.duration)).toBeCloseTo(0, 10);
  });
  it('拒绝无效参数和超出内存预算的导出任务', () => {
    expect(() => videoFrameCount({ ...DEFAULT_VIDEO, duration: NaN })).toThrow();
    expect(() => videoFrameCount({ ...DEFAULT_VIDEO, duration: 0 })).toThrow();
    expect(() => videoFrameCount({ ...DEFAULT_VIDEO, resolution: 2160, aspect: '16:9', fps: 60, duration: 30 })).toThrow('导出规模过大');
  });
  it('2K 使用双倍采样，4K 与较小显卡受像素预算和缓冲区上限保护',()=>{
    expect(videoRenderScale(2560,1440,8192)).toBe(2);
    const scale=videoRenderScale(3840,2160,8192);
    expect(scale).toBeGreaterThan(1);expect(3840*2160*scale*scale).toBeCloseTo(16_777_216,5);
    expect(videoRenderScale(2560,1440,4096)).toBe(1.6);
    expect(()=>videoRenderScale(7680,4320,4096)).toThrow('显卡不支持');
  });
});

it('4:5 和 3:4 保持短边分辨率，输出偶数尺寸并能通过导出校验',()=>{for(const resolution of [720,1080,1440,2160] as const){for(const aspect of ['4:5','3:4'] as const){const settings={...DEFAULT_VIDEO,resolution,aspect,duration:3};const d=videoDimensions(settings);expect(d.width).toBe(resolution);expect(d.height%2).toBe(0);expect(d.width/d.height).toBeCloseTo(aspect==='4:5'?.8:.75,3);expect(videoFrameCount(settings)).toBe(90);}}});

it('手机默认视频导出使用3:4，同一设置输出720×960，电脑保持16:9',async()=>{
 const {defaultVideoSettings}=await import('./videoSettings');
 expect(defaultVideoSettings(true).aspect).toBe('3:4');expect(videoDimensions(defaultVideoSettings(true))).toEqual({width:720,height:960});
 expect(defaultVideoSettings(false).aspect).toBe('16:9');
 expect(defaultVideoSettings(true,true).aspect).toBe('1:1');expect(videoDimensions(defaultVideoSettings(true,true))).toEqual({width:720,height:720});
});
