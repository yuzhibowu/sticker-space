import {cleanLivePhotoPackage} from './livePhotoPackage';
import type {StickerSceneData} from '../core/types';
import type {VideoSettings} from './videoSettings';
import {videoDimensions,videoFrameCount} from './videoSettings';
import {createVideoRenderer,HelperRequiredError,type VideoProgress} from './video';
import {ENDPOINT,checkNativeResponse,createNativeFrameQueue,cancelNativeExport,type NativeSession} from './nativeVideo';
import {livePhotoPlan,type LivePhotoSettings} from './livePhotoSettings';
export type LivePhotoResult={url:string;name:string;session:NativeSession;duration:number;coverTime:number};
export async function exportLivePhoto(scene:StickerSceneData,video:VideoSettings,settings:LivePhotoSettings,signal:AbortSignal,progress:(p:VideoProgress)=>void,endpoint=ENDPOINT):Promise<LivePhotoResult>{
 videoFrameCount({...video,duration:settings.duration});
 const plan=livePhotoPlan(scene,video,settings),name=`sticker-lab-live-${settings.duration}s-${Date.now()}.zip`;
 let session:NativeSession|undefined,completed=false,render:Awaited<ReturnType<typeof createVideoRenderer>>|undefined,queue:ReturnType<typeof createNativeFrameQueue>|undefined;
 try{
  progress({value:0,label:'连接实况导出助手…'});
  let caps:{available?:boolean;livePhoto?:boolean};
  try{const response=await checkNativeResponse(await fetch(`${endpoint}/capabilities`,{cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(2500)])}));caps=await response.json();}
  catch{signal.throwIfAborted();throw new HelperRequiredError('实况导出需要启动 饼饼导出助手 0.6.0。');}
  if(!caps.available||!caps.livePhoto)throw new HelperRequiredError('请更新并重启 饼饼导出助手 0.6.0，以使用实况导出。');
  const response=await checkNativeResponse(await fetch(`${endpoint}/start`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({format:'livephoto',fps:video.fps,totalFrames:plan.frames,coverFrame:plan.coverFrame,outputName:name,...videoDimensions(video)}),signal}));
  session={...await response.json(),endpoint,frameBatch:true};queue=createNativeFrameQueue(session!,signal);
  render=await createVideoRenderer(scene,plan.renderSettings,2,{background:settings.background});
  for(let frame=0;frame<plan.frames;frame++){
   signal.throwIfAborted();const png=await render.renderAtTime(plan.sourceTime(frame));signal.throwIfAborted();await queue.append(png);
   progress({value:(frame+1)/plan.frames*.9,label:`实况 · ${frame+1} / ${plan.frames} 帧`});
   if(frame%3===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  render.dispose();render=undefined;await queue.finish();
  progress({value:.93,label:'实况 · 配对封面与视频…'});
  const done=await checkNativeResponse(await fetch(`${endpoint}/finish/${session!.id}`,{method:'POST',signal}));await done.json();
  const result=await checkNativeResponse(await fetch(`${endpoint}/download/${session!.id}`,{signal}));const packageBytes=new Uint8Array(await result.arrayBuffer());signal.throwIfAborted();
  // Keep downloads importable even when an older helper adds guide/manifest files.
  const blob=new Blob([cleanLivePhotoPackage(packageBytes).buffer as ArrayBuffer],{type:'application/zip'});
  completed=true;return {url:URL.createObjectURL(blob),name,session:session!,duration:settings.duration,coverTime:plan.coverTime};
 }finally{await queue?.cancel();render?.dispose();if(session&&!completed)cancelNativeExport(session);}
}
export async function saveLivePhotoToPhotos(session:NativeSession){
 try{
  const response=await checkNativeResponse(await fetch(`${session.endpoint}/photos/${session.id}`,{method:'POST'}));
  return await response.json() as {saved:boolean};
 }catch(error){
  const message=error instanceof Error?error.message:String(error);
  if(/com\.apple\.photos\.error(?: error | Code=)41015\b/.test(message)){
   throw new Error('无法打开 Mac 的系统照片图库（41015）。请先打开“照片”，完成首次设置或打开原有图库；在“照片 → 设置 → 通用”中确认系统照片图库，然后重试。下载的实况 ZIP 已保留。');
  }
  throw error;
 }
}
