import {it,expect} from 'vitest';
import {DEFAULT_LIVE_PHOTO,LIVE_DURATIONS,livePhotoPlan} from './livePhotoSettings';
import {DEFAULT_VIDEO} from './videoSettings';
import {DEFAULT_MOTION,motionPlan} from '../core/motion';
import {POLE,type StickerSceneData} from '../core/types';
const scene:StickerSceneData={version:1,surface:POLE,assets:[],stickers:[]};
it('3～10 秒逐秒档位精确采样，封面首帧和末帧均位于片段内部',()=>{
 expect(LIVE_DURATIONS).toEqual([3,4,5,6,7,8,9,10]);
 for(const duration of LIVE_DURATIONS)for(const fps of [24,30,60] as const){
  const plan=livePhotoPlan(scene,{...DEFAULT_VIDEO,fps},{...DEFAULT_LIVE_PHOTO,duration,coverTime:duration});
  expect(plan.frames).toBe(duration*fps);expect(plan.coverFrame).toBe(duration*fps-1);expect(plan.coverTime).toBeLessThan(duration);
  expect(livePhotoPlan(scene,{...DEFAULT_VIDEO,fps},{...DEFAULT_LIVE_PHOTO,duration,coverTime:0}).coverFrame).toBe(0);
 }
});
it('原速片段保留绝对时间；完整适配明确缩放时间，默认封面包含全部贴纸',()=>{
 const sequence={...scene,motion:{...DEFAULT_MOTION,mode:'sequence' as const,turnDuration:12,heroAngle:45}};
 const source=motionPlan(sequence.stickers,sequence.motion);
 const original=livePhotoPlan(sequence,DEFAULT_VIDEO,DEFAULT_LIVE_PHOTO);
 expect(original.start).toBeCloseTo(source.duration-3);expect(original.sourceTime(30)-original.sourceTime(0)).toBe(1);
 expect(original.sourceTime(original.coverFrame)).toBeGreaterThanOrEqual(source.heroEnd);
 const fit=livePhotoPlan(sequence,DEFAULT_VIDEO,{...DEFAULT_LIVE_PHOTO,timing:'fit'});
 expect(fit.start).toBe(0);expect(fit.sourceTime(30)).toBeCloseTo(source.duration/3);
 expect(fit.sourceTime(fit.coverFrame)).toBeGreaterThanOrEqual(source.heroEnd-1/30*fit.scale);
 const custom=livePhotoPlan(sequence,DEFAULT_VIDEO,{...DEFAULT_LIVE_PHOTO,clipStart:2,coverTime:.5});
 expect(custom.sourceTime(custom.coverFrame)).toBe(2.5);
});
it('短动画按原速结束后定格，拒绝非整数秒、无效背景或时间',()=>{
 const sequence={...scene,motion:{...DEFAULT_MOTION,mode:'sequence' as const,turnDuration:2}};
 const plan=livePhotoPlan(sequence,DEFAULT_VIDEO,{...DEFAULT_LIVE_PHOTO,duration:10});expect(plan.start).toBe(0);expect(plan.sourceTime(299)).toBeCloseTo(299/30);
 for(const patch of [{duration:2},{duration:3.5},{duration:11},{coverTime:NaN},{clipStart:-1},{background:'transparent'}])expect(()=>livePhotoPlan(scene,DEFAULT_VIDEO,{...DEFAULT_LIVE_PHOTO,...patch})).toThrow();
});
