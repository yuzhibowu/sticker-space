import {AnimatedDetails} from './AnimatedDetails';
import {useEffect,useRef,useState} from 'react';
import type {StickerSceneData} from '../core/types';
import type {VideoSettings} from '../export/videoSettings';
import {DEFAULT_LIVE_PHOTO,LIVE_DURATIONS,livePhotoPlan,type LivePhotoSettings} from '../export/livePhotoSettings';
import {createVideoRenderer,HelperRequiredError,type VideoProgress} from '../export/video';
import {exportLivePhoto,saveLivePhotoToPhotos,type LivePhotoResult} from '../export/livePhoto';
import {releaseDownload,startDownload} from '../export/downloadFile';
import {HELPER_DOWNLOAD} from '../export/nativeVideo';
import {Options,SharedVideoControls} from './VideoExport';
import {HoverHint} from './HoverHint';
import {Parameter} from './Parameter';

export function LivePhotoExport({background,onBackgroundChange,onCustomBackground,scene,video,onVideoChange,ready,onRunning}:{background:string;onBackgroundChange:(value:string)=>void;onCustomBackground:()=>void;scene:StickerSceneData;video:VideoSettings;onVideoChange:(settings:VideoSettings)=>void;ready:boolean;onRunning:(running:boolean)=>void}){
 const [settings,setSettings]=useState<LivePhotoSettings>(DEFAULT_LIVE_PHOTO),[running,setRunning]=useState(false),[progress,setProgress]=useState<VideoProgress>(),[error,setError]=useState(''),[needsHelper,setNeedsHelper]=useState(false);
 useEffect(()=>{setSettings(s=>({...s,background:background==='transparent'?'#ffffff':background}));},[background]);
 const [result,setResult]=useState<LivePhotoResult>(),[cover,setCover]=useState(''),[previewError,setPreviewError]=useState(''),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false);
 const controller=useRef<AbortController>(),resultRef=useRef<LivePhotoResult>(),mounted=useRef(true),coverURL=useRef('');
 const [expanded,setExpanded]=useState(false);
 const plan=livePhotoPlan(scene,video,settings);
 useEffect(()=>{onRunning(running||saving);},[running,saving,onRunning]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();if(resultRef.current)releaseDownload(resultRef.current);if(coverURL.current)URL.revokeObjectURL(coverURL.current);};},[]);
 // Keep the preview renderer and image across drawer toggles. Serialize GPU work.
 const previewRenderer=useRef<Awaited<ReturnType<typeof createVideoRenderer>>>();
 const rendererKey=useRef<unknown[]>([]),imageKey=useRef<unknown[]>([]),previewQueue=useRef(Promise.resolve());
 useEffect(()=>()=>{void previewQueue.current.finally(()=>{previewRenderer.current?.dispose();previewRenderer.current=undefined;});},[]);
 useEffect(()=>{
  if(!expanded||!ready||running)return;
  let active=true;
  const base=[scene,video.aspect,video.fps,video.duration,settings.duration,settings.background,settings.timing,settings.clipStart];
  const key=[...base,settings.coverTime];
  const same=(a:unknown[],b:unknown[])=>a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));
  if(same(imageKey.current,key))return;
  const timer=setTimeout(()=>{
   previewQueue.current=previewQueue.current.catch(()=>{}).then(async()=>{
    if(!active)return;
    try{
     if(!previewRenderer.current||!same(rendererKey.current,base)){
      previewRenderer.current?.dispose();previewRenderer.current=undefined;
      const renderer=await createVideoRenderer(scene,{...plan.renderSettings,resolution:720 as const},1,{background:settings.background});
      previewRenderer.current=renderer;rendererKey.current=base;
     }
     if(!active)return;
     const blob=await previewRenderer.current.renderAtTime(plan.sourceTime(plan.coverFrame));
     if(!active)return;
     const url=URL.createObjectURL(blob);if(coverURL.current)URL.revokeObjectURL(coverURL.current);
     coverURL.current=url;imageKey.current=key;setCover(url);setPreviewError('');
    }catch(e){if(active){setPreviewError(e instanceof Error?e.message:'无法生成封面预览');}}
   });
  },400);
  return()=>{active=false;clearTimeout(timer);};
 },[scene,video.aspect,video.fps,video.duration,settings.duration,settings.background,settings.timing,settings.clipStart,settings.coverTime,ready,running,expanded]);
 const change=(patch:Partial<LivePhotoSettings>)=>setSettings(s=>({...s,...patch}));
 const start=async()=>{
  if(controller.current)return;
  const next=new AbortController();controller.current=next;setRunning(true);setProgress({value:0,label:'准备实况…'});setError('');setNeedsHelper(false);setSaved(false);
  if(resultRef.current){releaseDownload(resultRef.current);resultRef.current=undefined;}setResult(undefined);
  try{
   const file=await exportLivePhoto(structuredClone(scene),{...video},settings,next.signal,p=>{if(mounted.current)setProgress(p);});
   if(!mounted.current){releaseDownload(file);return;}
   resultRef.current=file;setResult(file);startDownload(file);
  }catch(e){if(mounted.current){setError(next.signal.aborted?'已取消实况导出':e instanceof Error?e.message:String(e));setNeedsHelper(e instanceof HelperRequiredError);}}
  finally{controller.current=undefined;if(mounted.current){setRunning(false);setProgress(undefined);}}
 };
 const save=async()=>{
  if(!result||saving||saved)return;setSaving(true);setError('');
  try{await saveLivePhotoToPhotos(result.session);if(mounted.current)setSaved(true);}
  catch(e){if(mounted.current)setError(e instanceof Error?e.message:String(e));}
  finally{if(mounted.current)setSaving(false);}
 };
 const sequence=scene.motion?.mode==='sequence';
 return <AnimatedDetails className="live-photo-export export-drawer" open={false} onExpandedChange={setExpanded}>
  <summary>实况照片 · Live Photo</summary>
  <fieldset className="editing-fields" disabled={running||saving||!ready}>
   <div className="live-background-control"><div className="section-label">背景色</div><div className="options" role="group" aria-label="实况照片背景色"><HoverHint text="实况无法用透明背景"><button disabled aria-disabled="true">透明</button></HoverHint>{[{value:'#000000',label:'黑色'},{value:'#ffffff',label:'白色'}].map(c=><button key={c.value} className={(background==='transparent'?'#ffffff':background)===c.value?'selected':''} onClick={()=>onBackgroundChange(c.value)}>{c.label}</button>)}<button className={!['transparent','#000000','#ffffff'].includes(background)?'selected':''} onClick={onCustomBackground}>自定义</button></div></div>
   <SharedVideoControls settings={video} onChange={onVideoChange} sequence={sequence} disabled={running||saving||!ready}/>
   <Options label="实况时长" value={settings.duration} choices={LIVE_DURATIONS.map(value=>({value,label:`${value} s`}))} onChange={duration=>change({duration,coverTime:null,clipStart:null})}/>
   {sequence&&<>
    <Options label="实况动画范围" value={settings.timing} choices={[{value:'original',label:'原速片段'},{value:'fit',label:'完整动画适配时长'}]} onChange={timing=>change({timing,clipStart:null,coverTime:null})}/>
    {settings.timing==='original'&&plan.maxStart>0&&<Parameter label="片段开始" value={plan.start} min={0} max={plan.maxStart} step={1/video.fps} unit="s" onChange={clipStart=>change({clipStart,coverTime:null})} onCommit={()=>{}}/>}
   </>}
   <div className="live-cover-preview">{cover&&!previewError?<img src={cover} alt={`实况封面 · 第 ${plan.coverTime.toFixed(2)} 秒`}/>:<span>{previewError||'正在生成封面预览…'}</span>}</div>
   <Parameter label="封面取自视频位置" value={plan.coverTime} min={0} max={(plan.frames-1)/video.fps} step={1/video.fps} unit="s" onChange={coverTime=>change({coverTime})} onCommit={()=>{}}/>
   <button className="text-button" onClick={()=>change({coverTime:null})}>恢复默认封面</button>
   <button className="export-button" onClick={()=>void start()}>{running?'正在导出实况…':'导出实况照片'}</button>
  </fieldset>
  {running&&<button className="cancel-button" onClick={()=>controller.current?.abort()}>取消实况导出</button>}
  {progress&&<div className="export-progress" role="status"><progress value={progress.value} max={1}/><span>{progress.label}</span></div>}
  {error&&<p role="status" className="export-error">{error}</p>}
  {needsHelper&&<div className="helper-download"><a href={HELPER_DOWNLOAD}>下载饼饼导出助手</a></div>}
  {result&&<div className="live-photo-result">
   <a href={result.url} download={result.name}>重新下载实况 ZIP</a>
   <button disabled={running||saving||saved||!ready} onClick={()=>void save()}>{saving?'正在存入照片…':saved?'已存入 Mac 照片':'存入 Mac 照片'}</button>
  </div>}
 </AnimatedDetails>;
}
