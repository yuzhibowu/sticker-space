import {prepareVideoFrames,decodeVideoFrame,recordingFrameDelay} from './preparedVideo';
import {createVideoRenderer,type VideoProgress,type VideoResult} from './video';
import {videoDimensions,videoFrameCount,type VideoSettings} from './videoSettings';
import type {StickerSceneData} from '../core/types';

export type MobileVideoResult=VideoResult&{blob:Blob;cover:Blob};
export const mobileVideoBackground=(background:string)=>background==='transparent'?'#ffffff':background;
export const mp4RecordingType=(supports:(type:string)=>boolean)=>['video/mp4;codecs=avc1.64002a','video/mp4;codecs=avc1.4d002a','video/mp4'].find(supports);
export const mobileVideoBitrate=(width:number,height:number,fps:number)=>Math.round(Math.max(8_000_000,Math.min(100_000_000,width*height*fps*.28)));
function wait(ms:number,signal:AbortSignal){return new Promise<void>((resolve,reject)=>{
 const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(signal.reason);};
 const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
 signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
});}

/** Both mobile platforms use native browser codecs, never localhost or a PNG-frame archive. */
export async function exportMobileVideo(data:StickerSceneData,settings:VideoSettings,background:string,signal:AbortSignal,progress:(value:VideoProgress)=>void):Promise<MobileVideoResult>{
 const frames=videoFrameCount(settings,true),{width,height}=videoDimensions(settings),bitrate=mobileVideoBitrate(width,height,settings.fps);
 const controller=new AbortController(),active=controller.signal;
 const abort=()=>controller.abort(signal.reason),hide=()=>{if(document.hidden)controller.abort(new Error('导出已中断，请保持页面在前台后重试。'));};
 signal.addEventListener('abort',abort,{once:true});document.addEventListener('visibilitychange',hide);
 if(signal.aborted)abort();
 let renderer:Awaited<ReturnType<typeof createVideoRenderer>>|undefined;
 let output:import('mediabunny').Output<import('mediabunny').Mp4OutputFormat,import('mediabunny').BufferTarget>|undefined;
 const cancelOutput=()=>{if(output&&output.state!=='finalized'&&output.state!=='canceled')void output.cancel().catch(()=>{});};
 active.addEventListener('abort',cancelOutput,{once:true});
 try{
  active.throwIfAborted();progress({value:0,label:'检查设备视频编码能力…'});
  const media=await import('mediabunny');active.throwIfAborted();
  const nativeFrames=typeof VideoEncoder!=='undefined'&&await media.canEncodeVideo('avc',{width,height,frameRate:settings.fps,bitrate});active.throwIfAborted();
  const recordingType=!nativeFrames&&typeof MediaRecorder!=='undefined'?mp4RecordingType(type=>MediaRecorder.isTypeSupported(type)):undefined;
  if(!nativeFrames&&!recordingType)throw new Error('当前浏览器无法编码 MP4，请在系统 Safari 或最新版 Chrome 中打开后重试。');
  progress({value:.02,label:'准备视频画面…'});
  renderer=await createVideoRenderer(data,settings,2,{background:mobileVideoBackground(background),stableSampling:true,boundedEncoding:true});active.throwIfAborted();
  renderer.drawAtTime(0);
  const cover=await new Promise<Blob>((resolve,reject)=>renderer!.canvas.toBlob(value=>value?resolve(value):reject(new Error('无法生成实况封面')),'image/jpeg',.98));
  active.throwIfAborted();
  let blob:Blob;
  if(nativeFrames){
   output=new media.Output({format:new media.Mp4OutputFormat({fastStart:'in-memory'}),target:new media.BufferTarget()});
   const source=new media.CanvasSource(renderer.canvas,{codec:'avc',bitrate,keyFrameInterval:1});
   output.addVideoTrack(source,{frameRate:settings.fps});await output.start();
   for(let frame=0;frame<frames;frame++){
    active.throwIfAborted();renderer.drawAtTime(frame/settings.fps);
    await source.add(frame/settings.fps,1/settings.fps);active.throwIfAborted();
    // Yield without depending on display refresh rate; encoded timestamps stay exact.
    if(frame%3===0){progress({value:.04+.91*(frame+1)/frames,label:`导出 MP4 · ${frame+1} / ${frames} 帧`});await wait(0,active);}
   }
   progress({value:.96,label:'完成 MP4 封装…'});await output.finalize();active.throwIfAborted();
   if(!output.target.buffer)throw new Error('视频编码没有返回文件，请重试。');
   blob=new Blob([output.target.buffer],{type:'video/mp4'});
  }else{
   const prepared=await prepareVideoFrames(renderer,frames,settings.fps,active,progress);active.throwIfAborted();
   const canvas=renderer.canvas;renderer.dispose();renderer=undefined;
   progress({value:.55,label:'正在合成流畅 MP4，请保持页面在前台…'});
   blob=await recordMp4(canvas,prepared,settings,recordingType!,bitrate,active,progress);
  }
  active.throwIfAborted();if(!blob.size)throw new Error('视频文件为空，请重试。');
  if(import.meta.env.DEV)await fetch('/__validation/video',{method:'POST',headers:{'x-lab-format':'mp4'},body:blob,signal:active}).catch(()=>active.throwIfAborted());
  progress({value:1,label:'MP4 已完成，可以预览或保存'});
  return {blob,cover,url:URL.createObjectURL(blob),name:`bingbing-sticker-${width}x${height}-${Date.now()}.mp4`};
 }catch(error){if(active.aborted)throw active.reason;throw error;}
 finally{active.removeEventListener('abort',cancelOutput);signal.removeEventListener('abort',abort);document.removeEventListener('visibilitychange',hide);if(output&&output.state!=='finalized')await output.cancel().catch(()=>{});renderer?.dispose();}
}
async function recordMp4(canvas:HTMLCanvasElement,frames:Blob[],settings:VideoSettings,mimeType:string,bitrate:number,signal:AbortSignal,progress:(value:VideoProgress)=>void){
 if(!canvas.captureStream)throw new Error('此浏览器不支持画布视频录制，请更新浏览器后重试。');
 const pixels=canvas.getContext('2d');if(!pixels)throw new Error('无法创建视频合成画布。');
 const chunks:Blob[]=[],decoded=new Map<number,Promise<Awaited<ReturnType<typeof decodeVideoFrame>>>>();
 let recorder:MediaRecorder|undefined,stream:MediaStream|undefined,requestFrame:(()=>void)|undefined,failure:unknown,finishTimer:ReturnType<typeof setTimeout>|undefined;
 let resolveDone!:()=>void;
 const done=new Promise<void>(resolve=>{resolveDone=resolve;});
 const stop=()=>{if(recorder&&recorder.state!=='inactive')recorder.stop();};
 const prefetch=(index:number)=>{
  if(index>=frames.length||decoded.has(index))return;
  const next=decodeVideoFrame(frames[index]);decoded.set(index,next);void next.catch(()=>{});
 };
 try{
  // Decode a bounded lookahead before starting the recorder; 3D rendering is already disposed.
  for(let i=0;i<4;i++)prefetch(i);await Promise.all(decoded.values());signal.throwIfAborted();
  pixels.drawImage((await decoded.get(0)!).image,0,0,canvas.width,canvas.height);
  try{
   stream=canvas.captureStream(0);const track=stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
   if(typeof track?.requestFrame!=='function')throw new Error('manual capture unavailable');
   track.requestFrame();requestFrame=()=>track.requestFrame();
  }catch{stream?.getTracks().forEach(track=>track.stop());stream=canvas.captureStream(settings.fps);}
  recorder=new MediaRecorder(stream!,{mimeType,videoBitsPerSecond:bitrate});
  recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
  recorder.onerror=()=>{failure=new Error('浏览器录制失败，请降低分辨率后重试。');resolveDone();};
  recorder.onstop=()=>resolveDone();signal.addEventListener('abort',stop,{once:true});signal.throwIfAborted();
  recorder.start(500);const started=performance.now();
  for(let frame=0;frame<frames.length;frame++){
   signal.throwIfAborted();if(failure)throw failure;
   prefetch(frame);const image=await decoded.get(frame)!;decoded.delete(frame);prefetch(frame+4);
   try{
    await wait(recordingFrameDelay(started,frame,settings.fps,performance.now()),signal);signal.throwIfAborted();
    pixels.drawImage(image.image,0,0,canvas.width,canvas.height);requestFrame?.();
   }finally{image.close();}
   if(frame%6===0)progress({value:.55+.4*(frame+1)/frames.length,label:`合成 MP4 · ${frame+1} / ${frames.length} 帧`});
  }
  await wait(recordingFrameDelay(started,frames.length,settings.fps,performance.now()),signal);
  stop();await Promise.race([done,new Promise<void>((_,reject)=>{finishTimer=setTimeout(()=>reject(new Error('浏览器完成录制超时，请重试。')),10_000);})]);signal.throwIfAborted();if(failure)throw failure;
  return new Blob(chunks,{type:'video/mp4'});
 }finally{
  clearTimeout(finishTimer);signal.removeEventListener('abort',stop);stop();stream?.getTracks().forEach(track=>track.stop());
  for(const image of decoded.values())void image.then(value=>value.close(),()=>{});decoded.clear();frames.length=0;
 }
}
