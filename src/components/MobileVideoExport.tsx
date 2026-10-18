import {useEffect,useRef,useState} from 'react';
import {AnimatedDetails} from './AnimatedDetails';
import {SharedVideoControls} from './VideoExport';
import {motionPlan} from '../core/motion';
import type {StickerSceneData} from '../core/types';
import type {VideoSettings} from '../export/videoSettings';
import type {VideoProgress} from '../export/video';
import {exportMobileVideo,type MobileVideoResult} from '../export/mobileVideo';
import {packAndroidMotionPhoto} from '../export/androidMotionPhoto';
import {releaseDownload,startDownload} from '../export/downloadFile';

export function MobileVideoExport({background,scene,settings:sharedSettings,onChange:sharedOnChange,onRunning,ready,livePhoto=false,androidLive=false}:{background:string;scene:StickerSceneData;settings:VideoSettings;onChange:(settings:VideoSettings)=>void;onRunning:(count:number)=>void;ready:boolean;livePhoto?:boolean;androidLive?:boolean}){
 const motionFile=useRef<{url:string;name:string;blob:Blob}|null>(null);
 const [liveQuality,setLiveQuality]=useState<Pick<VideoSettings,'resolution'|'fps'>>({resolution:1080,fps:60});
 const settings=livePhoto?{...sharedSettings,...liveQuality}:sharedSettings;
 const onChange=(next:VideoSettings)=>{if(livePhoto){setLiveQuality({resolution:next.resolution,fps:next.fps});sharedOnChange({...next,resolution:sharedSettings.resolution,fps:sharedSettings.fps});}else sharedOnChange(next);};
 const [running,setRunning]=useState(false),[progress,setProgress]=useState<VideoProgress|null>(null),[error,setError]=useState(''),[result,setResult]=useState<MobileVideoResult|null>(null),[sharing,setSharing]=useState(false);
 const controller=useRef<AbortController|null>(null),file=useRef<MobileVideoResult|null>(null),mounted=useRef(true);
 useEffect(()=>{onRunning(running?1:0);},[running,onRunning]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();if(file.current)releaseDownload(file.current);if(motionFile.current)releaseDownload(motionFile.current);};},[]);
 const start=async()=>{
  if(controller.current)return;
  if(motionFile.current){releaseDownload(motionFile.current);motionFile.current=null;}
  if(file.current){releaseDownload(file.current);file.current=null;}setResult(null);setError('');setProgress(null);setRunning(true);
  const next=new AbortController();controller.current=next;
  try{
   const video={...settings,...(scene.motion?.mode==='sequence'?{motion:scene.motion,duration:motionPlan(scene.stickers,scene.motion).duration}:{})};
   const output=await exportMobileVideo(structuredClone(scene),video,background,next.signal,value=>{if(mounted.current)setProgress(value);});
   if(!mounted.current||next.signal.aborted){releaseDownload(output);return;}if(androidLive){
    try{
     setProgress({value:.99,label:'封装当前模型的安卓实况照片…'});
     const packed=packAndroidMotionPhoto(new Uint8Array(await output.cover.arrayBuffer()),new Uint8Array(await output.blob.arrayBuffer()),'oplus');
     next.signal.throwIfAborted();
     const blob=new Blob([packed as BlobPart],{type:'image/jpeg'});
     motionFile.current={blob,url:URL.createObjectURL(blob),name:output.name.replace(/\.mp4$/i,'-MP.jpg')};
    }catch(error){releaseDownload(output);throw error;}
   }
   file.current=output;setResult(output);
  }catch(cause){if(mounted.current)setError(next.signal.aborted?'已取消导出':cause instanceof Error?cause.message:String(cause));}
  finally{controller.current=null;if(mounted.current){setRunning(false);setProgress(null);}}
 };
 const share=async()=>{
  if(!result)return;
  const video=new File([result.blob],result.name,{type:'video/mp4'});
  if(!navigator.canShare?.({files:[video]})){if(livePhoto)setError('当前浏览器不支持分享视频文件，请使用系统 Safari 打开网站后重试。');else startDownload(result);return;}
  setSharing(true);setError('');
  try{await navigator.share({files:[video]});}
  catch(cause){if((cause as DOMException).name!=='AbortError'&&mounted.current)setError(livePhoto?'未能打开系统分享，请重试，或使用系统 Safari 打开网站。':'未能打开系统分享，请使用“下载 MP4”保存。');}
  finally{if(mounted.current)setSharing(false);}
 };
 const shareAndroidLive=async()=>{
  const asset=motionFile.current;if(!asset||sharing)return;
  const photo=new File([asset.blob],asset.name,{type:'image/jpeg'});
  setError('');
  if(!navigator.share||!navigator.canShare?.({files:[photo]})){
   setError('当前浏览器不支持分享图片文件，请用最新版 Chrome 打开，或保存文件后测试。');return;
  }
  setSharing(true);
  try{await navigator.share({files:[photo]});}
  catch(cause){if((cause as DOMException).name!=='AbortError'&&mounted.current)setError('未能分享实况文件，请重试。');}
  finally{if(mounted.current)setSharing(false);}
 };
 const sequence=scene.motion?.mode==='sequence';
 return <AnimatedDetails className="video-export mobile-video-export export-drawer" open={false}>
  <summary>{livePhoto?'实况照片 · Live Photo':'视频 · MP4'}</summary>
  {livePhoto&&!androidLive&&<div className="mobile-live-setup">
   <div className="section-label">首次使用 · 完成以下两步</div>
   <div className="mobile-live-install-step"><a className="mobile-live-install-button" href="https://apps.apple.com/app/id1586435171" target="_blank" rel="noopener noreferrer">① 下载 Actions App（免费）↗</a><p className="section-help">免费。前往 App Store 安装，安装后打开一次。需要 iOS / iPadOS 26 或以上。</p></div><div className="mobile-live-install-step"><a className="mobile-live-install-button" href="https://www.icloud.com/shortcuts/1cbbeb8e228d453b8124f9248dfca6cd" target="_blank" rel="noopener noreferrer">② 添加饼饼实况导出快捷指令 ↗</a><p className="section-help">打开后点击“添加快捷指令”。名称：饼饼实况照片导出工具。</p></div>

  </div>}
  {androidLive&&<p className="section-help">生成当前模型的旋转实况文件。安卓兼容性仍在验证，一加 8T 上尚未通过识别测试。</p>}
  <SharedVideoControls settings={settings} onChange={onChange} sequence={sequence} disabled={!ready||running||sharing} mobile/>
  {!livePhoto&&<p className="section-help">{sequence?'完整贴入动画':'匀速旋转一整圈'} · {background==='transparent'?'白色背景':'当前背景色'} · 无需导出助手</p>}
  <div className={livePhoto?"export-action mobile-live-generate":"export-action"}><button className={livePhoto?"export-button mobile-live-install-button":"export-button"} disabled={!ready||running||sharing} onClick={()=>void start()}>{running?'正在生成视频…':livePhoto?(androidLive?'生成实况照片':'③ 生成实况照片'):'导出 MP4 视频'}</button>{running&&<button className="cancel-button" onClick={()=>controller.current?.abort()}>取消</button>}</div>
  {livePhoto&&!androidLive&&<p className="section-help">生成视频 → 保存为实况 → 在分享菜单选择“饼饼实况照片导出工具” → 自动存入相册。建议选择 2K / 4K，保留细字画质。首次保存需允许添加照片。</p>}
  {running&&<p className="section-help">导出时请保持此页面在前台。</p>}
  {running&&progress&&<div className="export-progress" role="status"><progress value={progress.value} max={1}/><span>{progress.label}</span><span>{Math.round(progress.value*100)}%</span></div>}
  {error&&<p role="status" className="export-error">{error}</p>}
  {result&&<div className="mobile-video-result">
   <p role="status" className="section-help">{androidLive?'当前模型文件已生成。下方播放的是内嵌视频。点击分享，在系统面板选择小红书；是否识别为实况仍需测试。':livePhoto?`视频已生成：${result.name}。点击“保存为实况”，在系统分享菜单下方的操作列表选择“饼饼实况照片导出工具”。`:'视频已完成，可先预览再保存。'}</p>
   <video controls playsInline preload="metadata" src={result.url} aria-label="已导出的 MP4 视频预览"/>
   {androidLive?<div className="export-action"><button className="export-button mobile-live-install-button" disabled={sharing||running} onClick={()=>void shareAndroidLive()}>{sharing?'正在打开分享…':'分享实况 · 选择小红书'}</button><button disabled={sharing||running} onClick={()=>{if(motionFile.current)startDownload(motionFile.current);}}>保存当前模型实况文件</button></div>:livePhoto?<div className="export-action"><button className="export-button" disabled={sharing||running} onClick={()=>void share()}>{sharing?'正在打开分享…':'保存为实况'}</button></div>:<div className="export-action"><button className="export-button" disabled={sharing||running} onClick={()=>void share()}>保存 / 分享视频</button><button disabled={sharing||running} onClick={()=>startDownload(result)}>下载 MP4</button></div>}
  </div>}
 </AnimatedDetails>;
}
