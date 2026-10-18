import type {VideoProgress} from './video';
export const PREPARED_VIDEO_LIMIT=128*1024*1024;
/** Keep compressed frames, not hundreds of decoded full-resolution canvases. */
export async function prepareVideoFrames(renderer:{canvas:HTMLCanvasElement;drawAtTime:(time:number)=>unknown},count:number,fps:number,signal:AbortSignal,progress:(value:VideoProgress)=>void){
 const frames:Blob[]=[];let bytes=0;
 for(let frame=0;frame<count;frame++){
  signal.throwIfAborted();renderer.drawAtTime(frame/fps);
  const encode=(type:string,quality?:number)=>new Promise<Blob>((resolve,reject)=>renderer.canvas.toBlob(value=>value?resolve(value):reject(new Error('无法准备视频画面，请重试。')),type,quality));
  // Preserve fine printed strokes without a JPEG round trip when the bounded cache permits it.
  let blob=await encode('image/png');signal.throwIfAborted();
  const remainingBudget=(PREPARED_VIDEO_LIMIT-bytes)/(count-frame);
  if(blob.size>remainingBudget)blob=await encode('image/jpeg',.995);
  signal.throwIfAborted();bytes+=blob.size;if(bytes>PREPARED_VIDEO_LIMIT)throw new Error('视频画面较多，请缩短时长或选择 720P 后重试。');frames.push(blob);
  if(frame%3===0)progress({value:.04+.51*(frame+1)/count,label:`准备流畅画面 · ${frame+1} / ${count} 帧`});
 }
 return frames;
}
/** Absolute deadlines include decode/paint cost, rather than adding another whole frame interval. */
export function recordingFrameDelay(start:number,frame:number,fps:number,now:number){return Math.max(0,start+frame*1000/fps-now);}
export async function decodeVideoFrame(blob:Blob):Promise<{image:CanvasImageSource;close:()=>void}>{
 if(typeof createImageBitmap==='function'){
  try{const image=await createImageBitmap(blob);return {image,close:()=>image.close()};}catch{/* Some Safari versions decode JPEG only through an image element. */}
 }
 const url=URL.createObjectURL(blob),image=new Image();
 try{await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('无法解码视频画面，请重试。'));image.src=url;});return {image,close:()=>{image.src='';URL.revokeObjectURL(url);}};}
 catch(error){URL.revokeObjectURL(url);throw error;}
}
