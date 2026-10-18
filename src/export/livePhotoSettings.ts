import {isImageBackground} from '../core/background';
import type {StickerSceneData} from '../core/types';
import {motionPlan} from '../core/motion';
import {videoFrameCount,type VideoSettings} from './videoSettings';
export const LIVE_DURATIONS=[3,4,5,6,7,8,9,10] as const;
export type LivePhotoSettings={duration:number;coverTime:number|null;clipStart:number|null;timing:'original'|'fit';background:string};
export const DEFAULT_LIVE_PHOTO:LivePhotoSettings={duration:3,coverTime:null,clipStart:null,timing:'original',background:'#ffffff'};
export function livePhotoPlan(scene:StickerSceneData,video:VideoSettings,settings:LivePhotoSettings){
 if(!(LIVE_DURATIONS as readonly number[]).includes(settings.duration)||(!/^#[0-9a-f]{6}$/i.test(settings.background)&&!isImageBackground(settings.background))||!['original','fit'].includes(settings.timing)
   ||settings.coverTime!==null&&(!Number.isFinite(settings.coverTime)||settings.coverTime<0)||settings.clipStart!==null&&(!Number.isFinite(settings.clipStart)||settings.clipStart<0))throw new Error('实况参数无效。');
 const sequence=scene.motion?.mode==='sequence';
 const motion=motionPlan(scene.stickers,scene.motion);
 const sourceDuration=sequence?motion.duration:settings.duration;
 const maxStart=sequence?Math.max(0,sourceDuration-settings.duration):0;
 const start=settings.timing==='fit'||!sequence?0:Math.min(maxStart,settings.clipStart??maxStart);
 const scale=settings.timing==='fit'&&sequence?sourceDuration/settings.duration:1;
 const frames=videoFrameCount({...video,resolution:720,duration:settings.duration});
 const defaultCover=sequence?(motion.heroEnd+Math.min(.5,(scene.motion?.hold??1)/2)-start)/scale:0;
 const coverFrame=Math.max(0,Math.min(frames-1,Math.round((settings.coverTime??defaultCover)*video.fps)));
 return {frames,coverFrame,coverTime:coverFrame/video.fps,start,maxStart,sourceDuration,scale,sourceTime:(frame:number)=>start+frame/video.fps*scale,
   renderSettings:{...video,duration:settings.duration,...(sequence?{motion:scene.motion}:{motion:undefined})}};
}
