import type {MotionSettings} from '../core/types';
export type VideoFormat = 'hevc' | 'mov';
export type CanvasAspect = '16:9' | '1:1' | '9:16' | '4:5' | '3:4';
export type VideoSettings = { resolution: 720 | 1080 | 1440 | 2160; aspect: CanvasAspect; fps: 24 | 30 | 60; duration: number; motion?:MotionSettings };
export const DEFAULT_VIDEO: VideoSettings = { resolution: 720, aspect: '16:9', fps: 30, duration: 8 };
export const MOBILE_LAYOUT_QUERY='(max-width: 520px), (pointer: coarse) and (max-width: 960px)';
export function defaultVideoSettings(mobile:boolean,ipad=false):VideoSettings{return {...DEFAULT_VIDEO,aspect:ipad?'1:1':mobile?'3:4':DEFAULT_VIDEO.aspect};}
// 接近 Retina 预览的采样密度；4K 或较弱设备按渲染缓冲区上限收敛，不改变成片尺寸。
export function videoRenderScale(width:number,height:number,maxDimension:number) {
  if (Math.max(width,height)>maxDimension) throw new Error('显卡不支持此输出尺寸，请降低分辨率。');
  return Math.max(1,Math.min(2,maxDimension/Math.max(width,height),Math.sqrt(16_777_216/(width*height))));
}
export const aspectRatio = (aspect: CanvasAspect) => aspect === '16:9' ? 16 / 9 : aspect === '9:16' ? 9 / 16 : aspect === '4:5' ? 4/5 : aspect === '3:4' ? 3/4 : 1;
export function videoDimensions(settings: VideoSettings) {
  const short = settings.resolution;
  const ratio=aspectRatio(settings.aspect);
  return ratio>=1?{width:Math.round(short*ratio/2)*2,height:short}:{width:short,height:Math.round(short/ratio/2)*2};
}
// 只采样唯一帧：最后一帧到下一轮第一帧恰好一个步长，没有重复的 360° 终点。
export const turntableAngle = (time: number, duration: number) => -((time % duration + duration) % duration) / duration * Math.PI * 2;
export function videoFrameCount(settings: VideoSettings, boundedEncoding = false) {
  const { width, height } = videoDimensions(settings);
  if (![720, 1080, 1440, 2160].includes(settings.resolution) || !['16:9', '1:1', '9:16', '4:5', '3:4'].includes(settings.aspect) || ![24, 30, 60].includes(settings.fps) || !Number.isFinite(settings.duration) || settings.duration < 1 || settings.duration > (settings.motion?.mode==='sequence'?120:30)) throw new Error('视频参数无效');
  const frames = Math.round(settings.duration * settings.fps);
  if (!boundedEncoding && width * height * frames > 2_000_000_000) throw new Error('导出规模过大，请降低分辨率、帧率或周期。');
  return frames;
}
