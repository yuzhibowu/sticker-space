import {FloatingControls} from './components/FloatingControls';
import {importBackgroundImage,isImageBackground} from './core/background';
import {preparePlaceSound,playPlaceSound} from './scene/placeSound';
import {MobileVideoExport} from './components/MobileVideoExport';
import {MobileDraftSticker} from './components/MobileDraftSticker';
import {scrollPhonePage} from './core/phoneScroll';
import {isPhoneDevice,isIPadDevice,phoneStickerTarget} from './core/phoneControls';
import {MobileStickerControls,MobileModelPan,MobileStickerPicker} from './components/MobileStickerControls';
import {originalModelColor} from './core/modelColor';
import {DEFAULT_MODEL_EXAMPLE} from './core/modelExamples';
import {ModelColorControls} from './components/ModelColorControls';
import placeStickerIcon from './assets/icons/place-sticker.png';
import {MODEL_EXAMPLES,isModelExample,loadModelExample} from './core/modelExamples';
import {LightingControls} from './components/LightingControls';
import {horizontalStickerRoll,verticalStickerSize} from './core/stickerGestures';
import {ApertureLoading} from './components/ApertureLoading';
import {HoverHint} from './components/HoverHint';
import {flushSync} from 'react-dom';
import {AnimatedDetails} from './components/AnimatedDetails';
import {PropertyGroup} from './components/PropertyGroup';
import {StickerFollower} from './components/StickerFollower';
import {assetTextures} from './scene/assetTextures';
import {RoundedCursor} from './components/RoundedCursor';
import {DEFAULT_MOTION,motionPlan} from './core/motion';
import {modelDropFiles} from './core/modelDrop';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import * as THREE from 'three';
import {importCustomModel} from './core/customModel';
import {ModelPicker} from './components/ModelPicker';
import {PeelCredit} from './components/PeelCredit';
import {LivePhotoExport} from './components/LivePhotoExport';
import {isAppleTouchDevice,isAndroidDevice} from './core/phoneControls';
import {AnimationControls} from './components/AnimationControls';
import { Scene, type SceneAPI } from './scene/Scene';
import { RETIRED_DEFAULT_STICKERS, demoAssets, refreshDefaultAssets, importPNG, loadImage, previewImage } from './core/assets';
import { useStickerManager } from './core/StickerManager';
import { arcFootprint, clampPlacementY, fittedScale, orientation, resolveMethod } from './core/geometry';
import { loadSurface, modelAnchor,modelHit } from './core/modelSurface';
import { isOrbitKey } from './core/keyboardOrbit';
import { stickerRoll } from './core/editing';
import { DAVID, POLE,ROAD_SIGN, type Placement, type StickerData, type StickerMethod, type StickerSceneData } from './core/types';
import { exportUSDZ } from './export/pipeline';
import { releaseDownload, startDownload } from './export/downloadFile';
import { useProjectDraft } from './core/useProjectDraft';
import { parseProject,portableProject } from './core/project';
import { transformSticker } from './core/editing';
import {signPoleSurface} from './core/signAttachment';
import {defaultModelView} from './core/poleDimensions';
import {isAutoFrameExample,isLegacyExampleView} from './core/modelFraming';
import {PoleLengthControls} from './components/PoleLengthControls';
import {SignTextControls} from './components/SignTextControls';
import {importSignFont} from './core/customSignFont';
import { Parameter } from './components/Parameter';
import { StickerEditor } from './components/StickerEditor';
import { PreviewFrame } from './components/PreviewFrame';
import { Options, VideoExport } from './components/VideoExport';
import {videoDimensions} from './export/videoSettings';
import { defaultVideoSettings, MOBILE_LAYOUT_QUERY } from './export/videoSettings';

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    sticker: <><path d="M10 11V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v7l-4 4h-3M17 15v-4h4" /><path d="M4 21v-6l-1-2a1.5 1.5 0 0 1 2.4-1.7L8 14V9a1.5 1.5 0 0 1 3 0v4l3-1a2 2 0 0 1 2.5 1.9v3.6L14 21M4 18h10" /></>,
    edit: <><path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15z" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3.2"/><path d="m12 9-2 3h3l-1 3"/></>,
    orbit: <><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-35 12 12)" /><circle cx="12" cy="12" r="2" /></>,
    reset: <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" /></>,
    play: <path d="m8 5 11 7-11 7z" />,
    pause: <path d="M8 5v14M16 5v14" />,
    undo: <><path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12" /></>,
    trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>,
    check: <path d="m5 12 4 4 10-10" />,
    arrow: <path d="M4 12h16m-5-5 5 5-5 5" />,
    download: <><path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.plus}</svg>;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export default function App() {
  useEffect(()=>{void preparePlaceSound()?.catch(()=>{});},[]);
  const [brandRevealed,setBrandRevealed]=useState(false);
  const [brandInteracted,setBrandInteracted]=useState(false);
  const [theme,setTheme]=useState<'dark'|'light'>(()=>localStorage.getItem('sticker-lab-theme')==='light'?'light':'dark');
  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('sticker-lab-theme',theme);},[theme]);
  const toggleTheme=()=>{
    const next=theme==='dark'?'light':'dark';
    const apply=()=>flushSync(()=>{document.documentElement.dataset.theme=next;setTheme(next);});
    const page=document as Document & {startViewTransition?:(update:()=>void)=>{finished:Promise<void>;skipTransition:()=>void}};
    if(page.startViewTransition)page.startViewTransition(apply);
    else apply();
  };
  const [scene, dispatch] = useStickerManager(useMemo(() => ({ version: 1, surface: DEFAULT_MODEL_EXAMPLE, modelColor:originalModelColor(DEFAULT_MODEL_EXAMPLE), assets: demoAssets(), stickers: [] } as StickerSceneData), []));
  const [assetMenu,setAssetMenu]=useState<{id:string;x:number;y:number}|null>(null);
  useEffect(()=>{if(!assetMenu)return;const close=()=>setAssetMenu(null),key=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};window.addEventListener('pointerdown',close);window.addEventListener('keydown',key);window.addEventListener('blur',close);window.addEventListener('scroll',close,true);return()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('keydown',key);window.removeEventListener('blur',close);window.removeEventListener('scroll',close,true);};},[assetMenu]);
  const [zooming,setZooming]=useState(false);
  const [activeId, setActiveId] = useState('demo-lab');
  const [mode, setMode] = useState<'place' | 'edit' | 'view'>('view');
  const [ipadDevice]=useState(()=>isIPadDevice(navigator.userAgent,navigator.maxTouchPoints));
  const [phoneDevice]=useState(()=>isPhoneDevice(navigator.userAgent,(navigator as Navigator&{userAgentData?:{mobile?:boolean}}).userAgentData?.mobile,navigator.maxTouchPoints));
  const phoneDropping=useRef(false);
  const [phoneDraftVisible,setPhoneDraftVisible]=useState(false);
  const phoneDraftSettings=useRef({size:.95,angle:8});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phonePickerOpen,setPhonePickerOpen]=useState(false),[phonePickerRequest,setPhonePickerRequest]=useState(0);
  const phonePreviewReturn=useRef<number|null>(null),phoneScrollFrame=useRef(0),phoneScrollCancel=useRef<(()=>void)|null>(null);
  const [stickerPointerOrigin,setStickerPointerOrigin]=useState<{x:number;y:number;extent:number}|null>(null);
  const [size, setSize] = useState(0.95), [rotation, setRotation] = useState(-8);
  const [method, setMethod] = useState<StickerMethod>('auto');
  const [hover, setHover] = useState<Placement | null>(null), [autoRotate, setAutoRotate] = useState(false);
  const [message, setMessage] = useState('');
  const [modelLoading, setModelLoading] = useState(false);
  const [fontLoading,setFontLoading]=useState(false);
  const modelKey=scene.surface.id+(scene.surface.kind==='sign'?':'+(scene.surface.font?.id??'default'):'');
  const [modelReady, setModelReady] = useState(POLE.id), [modelError,setModelError] = useState(''), [modelRetry,setModelRetry] = useState(0);
  const [modelReadySource,setModelReadySource]=useState('');
  const modelSource=scene.surface.kind==='custom'?scene.surface.source:'';
  useEffect(()=>{
    let cancelled=false; setModelError('');
    (async()=>{let surface=scene.surface;const bundled=MODEL_EXAMPLES.find(example=>example.id===surface.id);if(bundled)surface=await loadModelExample(bundled);else if(surface.kind==='custom'&&surface.source.startsWith('/models/'))surface=await loadModelExample(surface);await loadSurface(surface);if(!cancelled){if(surface.kind==='custom'&&scene.surface.kind==='custom'?surface.source!==scene.surface.source:surface!==scene.surface)dispatch({type:'loaded-surface',surface});setModelReady(modelKey);setModelReadySource(surface.kind==='custom'?surface.source:modelSource);}})().catch(error=>{if(!cancelled) setModelError(error instanceof Error ? error.message : String(error));});
    return ()=>{cancelled=true;};
  },[modelKey,modelRetry,modelSource]);
  const modelAvailable=modelReady===modelKey&&modelReadySource===modelSource;
  const [previewReady,setPreviewReady]=useState('');
  useEffect(()=>{setPreviewReady('');},[modelKey,modelSource]);
  // Keep one WebGL canvas alive while an unready model/font is loading.
  const readyPreview=useRef<StickerSceneData>({...scene,surface:POLE,modelColor:undefined});
  if(modelAvailable)readyPreview.current=scene;
  const previewScene=readyPreview.current;

  const [dragging, setDragging] = useState(false), [busy, setBusy] = useState(false);
  const [correction] = useState<'auto' | 'off'>('off');
  const [usdzAnimation,setUsdzAnimation]=useState(false);
  const [usdzAppearance,setUsdzAppearance]=useState(true);
  const [usdzTarget,setUsdzTarget]=useState<'freeform'|'keynote'>('freeform');
  const [motionTime,setMotionTime]=useState<number|null>(null),[motionPlaying,setMotionPlaying]=useState(false);
  const [mobileLayout,setMobileLayout]=useState(()=>phoneDevice||window.matchMedia(MOBILE_LAYOUT_QUERY).matches);
  useEffect(()=>{const query=window.matchMedia(MOBILE_LAYOUT_QUERY);const sync=()=>setMobileLayout(phoneDevice||query.matches);query.addEventListener('change',sync);sync();return()=>query.removeEventListener('change',sync);},[phoneDevice]);
  const [videoSettings, setVideoSettings] = useState(()=>defaultVideoSettings(phoneDevice,ipadDevice));
  const videoAspectChosen=useRef(false);
  const changeVideoSettings=useCallback((settings:typeof videoSettings)=>{videoAspectChosen.current=true;setVideoSettings(settings);},[]);
  useEffect(()=>{if(!videoAspectChosen.current)setVideoSettings(value=>({...value,aspect:defaultVideoSettings(phoneDevice,ipadDevice).aspect}));},[phoneDevice,ipadDevice]);
  useEffect(()=>{if(scene.motion)setVideoSettings(value=>({...value,duration:scene.motion!.turnDuration}));},[scene.motion?.turnDuration]);
  const [panelWidth,setPanelWidth]=useState(()=>Math.max(232,Math.min(376,Math.round(window.innerWidth/3))));
  const [previewBackground, setPreviewBackground] = useState('transparent');
  const [customBackground,setCustomBackground]=useState('#808080');
  const colorInput=useRef<HTMLInputElement>(null),backgroundImageInput=useRef<HTMLInputElement>(null);
  const [imageBackground,setImageBackground]=useState('');
  const uploadBackground=async(file:File)=>{try{const image=await importBackgroundImage(file);setImageBackground(image);setPreviewBackground(image);}catch(error){setMessage(error instanceof Error?error.message:String(error));}};
  const [runningVideos, setRunningVideos] = useState(0);
  const apertureClosed=useRef<(()=>void)|null>(null);
  const onApertureClosed=useCallback(()=>{apertureClosed.current?.();apertureClosed.current=null;},[]);
  const closeAperture=()=>new Promise<void>(resolve=>{apertureClosed.current=resolve;flushSync(()=>{setModelLoading(true);setPreviewReady('');});});
  const api = useRef<SceneAPI | null>(null);
  const onNavigate = useCallback(() => { setMotionTime(null);setMotionPlaying(false); api.current?.freezeAutoRotation(); setAutoRotate(false); setHover(null); }, []);
  const openPhoneStickerPicker=()=>{
    commitPhoneSticker();phoneScrollCancel.current?.();phonePreviewReturn.current=window.scrollY;
    setPhonePickerOpen(true);setPhonePickerRequest(value=>value+1);setMode('place');setHover(null);setSelectedId(null);onNavigate();
  };
  useLayoutEffect(()=>{
    if(!phonePickerOpen)return;
    cancelAnimationFrame(phoneScrollFrame.current);
    let cancelScroll:(()=>void)|undefined;
    const frame=requestAnimationFrame(()=>{
      const heading=document.querySelector('.sticker-group > summary');if(heading){phoneScrollCancel.current?.();cancelScroll=scrollPhonePage(window.scrollY+heading.getBoundingClientRect().top);phoneScrollCancel.current=cancelScroll;}
    });
    phoneScrollFrame.current=frame;
    return()=>{cancelAnimationFrame(frame);cancelScroll?.();};
  },[phonePickerOpen,phonePickerRequest]);
  const returnFromPhoneStickerPicker=()=>{
    const position=phonePreviewReturn.current;if(position===null)return;
    phonePreviewReturn.current=null;phoneScrollCancel.current?.();setPhonePickerOpen(false);cancelAnimationFrame(phoneScrollFrame.current);
    phoneScrollFrame.current=requestAnimationFrame(()=>{
      (document.querySelector('.stage') as HTMLElement|null)?.focus({preventScroll:true});phoneScrollCancel.current=scrollPhonePage(position);
    });
  };
  useEffect(()=>()=>{cancelAnimationFrame(phoneScrollFrame.current);phoneScrollCancel.current?.();},[]);
  const onVideoRunning = useCallback((count: number) => setRunningVideos(count), []);
  useEffect(()=>{setAutoRotate(false);setMotionPlaying(false);setMotionTime(null);},[scene.surface.id]);
  const [liveRunning,setLiveRunning]=useState(false);
  const exporting = runningVideos > 0 || liveRunning || busy || fontLoading;
  const [exportFile, setExportFile] = useState<{url:string;name:string} | null>(null);
  const [testTime, setTestTime] = useState('live');
  const [projectFile, setProjectFile] = useState<{ url: string; name: string } | null>(null);
  const [performanceInfo, setPerformanceInfo] = useState<ReturnType<SceneAPI['getDiagnostics']> | null>(null);
  useEffect(() => setPerformanceInfo(null), [scene.stickers, scene.assets]);
  const modelInput=useRef<HTMLInputElement>(null);
  const customWorks=[scene,...(scene.otherModels??[])].filter(w=>w.surface.kind==='custom');
  const projectInput = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const origin = useRef(performance.now());
  const now = useCallback(() => (performance.now() - origin.current) / 1000, []);
  const draft = useProjectDraft();
  const apertureBusy=!draft.ready||!modelAvailable||modelLoading||previewReady!==modelKey;
  const phoneTarget=phoneDevice&&phoneDraftVisible&&mode==='place'?undefined:phoneStickerTarget(scene.stickers,mode,selectedId);
  const phoneAdjustment=useRef<{sticker?:StickerData;size:number;angle:number}|null>(null);
  useEffect(()=>{phoneAdjustment.current=null;api.current?.cancelStickerEdit();},[phoneTarget?.id,scene.surface.id,mode]);
  useEffect(()=>{if(!phoneAdjustment.current)phoneDraftSettings.current={size,angle:-rotation};},[size,rotation]);
  useEffect(()=>setPhoneDraftVisible(false),[scene.surface.id]);
  const adjustPhoneSticker=(changes:{width?:number;angle?:number})=>{
    const previous=phoneAdjustment.current??{sticker:phoneTarget,size:phoneTarget?.scale[0]??size,angle:phoneTarget?-stickerRoll(phoneTarget)*180/Math.PI:-rotation};
    const next={...previous,size:changes.width??previous.size,angle:changes.angle??previous.angle};
    if(previous.sticker){
      next.sticker=transformSticker(previous.sticker,signPoleSurface(scene.surface,previous.sticker)??scene.surface,{...(changes.width!==undefined?{width:changes.width}:{}),...(changes.angle!==undefined?{roll:-changes.angle*Math.PI/180}:{})});
      next.size=next.sticker.scale[0];api.current?.previewStickerEdit(next.sticker);
    }
    phoneAdjustment.current=next;phoneDraftSettings.current={size:next.size,angle:next.angle};
  };
  const commitPhoneSticker=()=>{
    const adjustment=phoneAdjustment.current;if(!adjustment)return;phoneAdjustment.current=null;
    setSize(adjustment.size);setRotation(-adjustment.angle);
    if(adjustment.sticker){api.current?.finishStickerEdit(adjustment.sticker);dispatch({type:'update',sticker:adjustment.sticker,group:`${adjustment.sticker.id}:mobile-adjust`});dispatch({type:'commit'});}
  };
  const selected = scene.stickers.find(s => s.id === selectedId);
  useEffect(() => { if (selectedId && !selected) setSelectedId(null); }, [selectedId, selected]);
  useEffect(() => () => { if (projectFile) URL.revokeObjectURL(projectFile.url); }, [projectFile]);
  useEffect(() => () => { if (exportFile) void releaseDownload(exportFile); }, [exportFile]);
  useEffect(() => {
    api.current?.renderAtTime(testTime === 'live' ? null : (scene.stickers.at(-1)?.placedAt ?? 0) + Number(testTime));
  }, [testTime, scene.stickers]);
  const active = scene.assets.find(a => a.id === activeId) ?? scene.assets[0];
  useEffect(()=>assetTextures.acquire(active.image,()=>{}),[active.image]);
  const makeSticker = useCallback((hit: Placement, assetId = activeId, width = size, rollDegrees = rotation, choice = method, fixedSize = false): StickerData => {
    const asset = scene.assets.find(a => a.id === assetId) ?? (assetId.startsWith('demo-') ? demoAssets().find(a => a.id === assetId) : undefined) ?? scene.assets[0];
    const roll = THREE.MathUtils.degToRad(rollDegrees);
    const support=signPoleSurface(scene.surface,hit) ?? scene.surface;
    const scale = fittedScale(width, asset.width / asset.height, fixedSize?0:roll, support);
    const position = [...hit.position] as [number, number, number];
    return {
      id: crypto.randomUUID(), surfaceId: scene.surface.id, assetId: asset.id, position, normal: hit.normal,
      rotation: orientation(hit.normal, roll).toArray().slice(0, 3) as [number, number, number],
      scale, method: scene.surface.kind !== 'cylinder' ? 'conform' : resolveMethod(choice, arcFootprint(scale, roll), scene.surface.radius),
      order: Math.max(-1, ...scene.stickers.map(s => s.order)) + 1, placedAt: now(),
    };
  }, [activeId, size, rotation, method, scene, now]);
  const carryPixels=useCallback((x:number,y:number)=>{const scale=fittedScale(size,active.width/active.height,THREE.MathUtils.degToRad(rotation),scene.surface);return api.current?.previewPixels(x,y,Math.max(...scale))??30*size/.95;},[size,active,rotation,scene.surface]);
  const pending = useMemo(() => hover && mode === 'place' && !autoRotate ? makeSticker(hover) : null, [hover, mode, autoRotate, makeSticker]);
  const place = (hit: Placement) => {
    if (mode !== 'place' || autoRotate) return;
    if (scene.stickers.length >= 2000) { setMessage('当前工程最多支持 2000 张贴纸。'); return; }
    const preferences=phoneDevice?phoneDraftSettings.current:null;
    const sticker=makeSticker(hit,activeId,preferences?.size??size,preferences?-preferences.angle:rotation,method,phoneDevice);if(phoneDevice){phoneAdjustment.current=null;phoneDraftSettings.current={...phoneDraftSettings.current,size:.95};setSize(.95);setPhoneDraftVisible(true);}dispatch({ type: 'place', sticker }); playPlaceSound(); setHover(null); setMessage(phoneDevice?'啪！贴好了。从左上角继续拖一张。':'啪！贴好了。继续点击，可以重复贴同一张。');
  };
  const upload = async (files: FileList | File[]) => {
    if (!files.length) return;
    setMessage('正在读取 PNG…');
    if (scene.assets.length + files.length > 200) { setMessage('当前工程最多支持 200 张素材，请减少导入数量。'); return; }
    const results = await Promise.allSettled(Array.from(files).map(importPNG));
    const assets = results.flatMap(r => r.status === 'fulfilled' ? [r.value] : []);
    if ([...scene.assets, ...assets].reduce((sum, a) => sum + a.image.length, 0) > 95 * 1024 * 1024) { setMessage('工程图片数据过大，请压缩 PNG 后再导入。'); return; }
    if (assets.length) {
      dispatch({ type: 'assets', assets }); setActiveId(assets[0].id);if(phoneDevice)setPhoneDraftVisible(true); setMode('place'); setAutoRotate(false);
    }
    const errors = results.flatMap(r => r.status === 'rejected' ? [String(r.reason.message || r.reason)] : []);
    setMessage(errors.length ? errors.join('；') : `已导入 ${assets.length} 张 PNG。移动到模型表面，点击贴上。`);
  };
  useEffect(()=>{
    const paste=(event:ClipboardEvent)=>{
      if(exporting||modelLoading||!modelAvailable||!draft.ready)return;
      const target=event.target;
      if(target instanceof Element&&target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))return;
      const data=event.clipboardData;
      if(!data)return;
      const files=Array.from(data.files).filter(file=>file.type==='image/png'||/\.png$/i.test(file.name));
      if(!files.length)return;
      event.preventDefault();
      void upload(files);
    };
    window.addEventListener('paste',paste);
    return()=>window.removeEventListener('paste',paste);
  },[exporting,modelLoading,modelAvailable,draft.ready,upload]);
  const uploadModel=async(files:File[])=>{
    if(!files.length)return;
    onNavigate();const closed=closeAperture();setMessage('正在解析模型和贴图…');
    try{
      await closed;
      if(customWorks.filter(w=>!isModelExample(w.surface.id)).length>=10)throw new Error('最多保存 10 个自定义模型。');
      const surface=await importCustomModel(files);
      if(surface.source.length+customWorks.reduce((n,w)=>n+(w.surface.kind==='custom'?w.surface.source.length:0),0)>125*1024*1024)throw new Error('工程中的模型数据过大，请简化后再导入。');
      setModelReady(surface.id);dispatch({type:'surface',surface});setSelectedId(null);setHover(null);setAutoRotate(false);setMode('view');setMessage('模型已导入，原材质和贴图随工程保存，可以直接贴纸。');
    }catch(error){setPreviewReady(modelKey);setMessage(`导入失败：${error instanceof Error?error.message:String(error)}`);}finally{setModelLoading(false);}
  };
  const switchModel = async (value: string) => {
    const fallback = value === 'david' ? DAVID : value==='sign' ? ROAD_SIGN : POLE;
    const example=MODEL_EXAMPLES.find(s=>s.id===value),savedWork=customWorks.find(w=>w.surface.id===value),saved=savedWork?.surface;
    let surface=value.startsWith('custom-')?saved??example??fallback:scene.otherModels?.find(w=>w.surface.kind===fallback.kind)?.surface??fallback;
    if (surface.id === scene.surface.id) return;
    if(import.meta.env.DEV){performance.clearMarks('sticker-lab-switch');performance.mark('sticker-lab-switch',{detail:surface.id});}
    const preparing=(async()=>{const next=example?await loadModelExample(example):surface;await loadSurface(next);return next;})();
    void preparing.catch(()=>{});
    const closed=closeAperture(); setMessage(surface.kind === 'mesh' ? '正在加载大卫扫描模型…' : '正在切换模型…');
    try { await closed; await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())); surface=await preparing; const view=isAutoFrameExample(surface)&&(!savedWork?.view||isLegacyExampleView(savedWork.view))?api.current?.defaultView(surface):undefined;setModelReady(surface.id+(surface.kind==='sign'?':'+(surface.font?.id??'default'):'')); setModelReadySource(surface.kind==='custom'?surface.source:'');dispatch({type:'surface',surface});if(view)dispatch({type:'view',view});setSelectedId(null); setHover(null); setAutoRotate(false); setMode('view'); setMessage('模型已切换，各自的贴纸作品已保留。'); }
    catch (error) { setPreviewReady(modelKey);setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setModelLoading(false); }
  };
  const togglePlayback=()=>{
    if(exporting||!draft.ready||modelLoading||!modelAvailable)return;
    setHover(null);
    if(scene.motion?.mode==='sequence'){
      api.current?.freezeAutoRotation();setAutoRotate(false);
      if(!motionPlaying&&(motionTime===null||motionTime>=motionPlan(scene.stickers,scene.motion??DEFAULT_MOTION).duration)){api.current?.resetCamera();setMotionTime(0);}
      setMotionPlaying(value=>!value);
    }else{
      setMotionPlaying(false);setMotionTime(null);
      setAutoRotate(value=>!value);
    }
  };
  useEffect(()=>{
    const playback=(event:KeyboardEvent)=>{
      if(event.code!=='Space'||event.metaKey||event.ctrlKey||event.altKey)return;
      if(event.isComposing)return;
      event.preventDefault();event.stopImmediatePropagation();
      if(!event.repeat)togglePlayback();
    };
    const release=(event:KeyboardEvent)=>{if(event.code==='Space'&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!event.isComposing){event.preventDefault();event.stopImmediatePropagation();}};
    window.addEventListener('keydown',playback,true);window.addEventListener('keyup',release,true);
    return()=>{window.removeEventListener('keydown',playback,true);window.removeEventListener('keyup',release,true);};
  },[autoRotate,motionPlaying,motionTime,scene.motion,scene.stickers,exporting,draft.ready,modelLoading,modelAvailable]);
  const angleWheelCommit=useRef<ReturnType<typeof setTimeout>>();
  useEffect(()=>()=>clearTimeout(angleWheelCommit.current),[]);
  useEffect(()=>{
    const wheel=(event:WheelEvent)=>{
      if((mode!=='place'&&!(mode==='edit'&&selected))||autoRotate||motionTime!==null||exporting||modelLoading||!modelAvailable||!draft.ready||event.metaKey||event.ctrlKey||event.altKey||!(event.target instanceof Element)||!event.target.closest('.output-frame'))return;
      const horizontal=Math.abs(event.deltaX)>Math.abs(event.deltaY);
      if(!event.deltaX&&!event.deltaY)return;
      event.preventDefault();event.stopImmediatePropagation();
      const unit=event.deltaMode===1?16:event.deltaMode===2?window.innerHeight:1;
      if(horizontal){
        const turn=(degrees:number)=>horizontalStickerRoll(degrees,event.deltaX*unit);
        if(mode==='edit'&&selected){
          dispatch({type:'update',sticker:transformSticker(selected,signPoleSurface(scene.surface,selected)??scene.surface,{roll:THREE.MathUtils.degToRad(turn(THREE.MathUtils.radToDeg(stickerRoll(selected))))}),group:`${selected.id}:trackpad-angle`});
          clearTimeout(angleWheelCommit.current);angleWheelCommit.current=setTimeout(()=>dispatch({type:'commit'}),180);
        }else setRotation(turn);
      }else{
        const delta=event.deltaY*unit;
        if(mode==='edit'&&selected){
          dispatch({type:'update',sticker:transformSticker(selected,signPoleSurface(scene.surface,selected)??scene.surface,{width:verticalStickerSize(selected.scale[0],delta)}),group:`${selected.id}:trackpad-size`});
          clearTimeout(angleWheelCommit.current);angleWheelCommit.current=setTimeout(()=>dispatch({type:'commit'}),180);
        }else setSize(value=>verticalStickerSize(value,delta));
      }
    };
    window.addEventListener('wheel',wheel,{capture:true,passive:false});
    return()=>window.removeEventListener('wheel',wheel,true);
  },[mode,selected,scene.surface,autoRotate,motionTime,exporting,modelLoading,modelAvailable,draft.ready]);
  useEffect(() => {
    const eventSize=(event:KeyboardEvent)=>{
      event.preventDefault();
      const resize=(value:number)=>Math.max(.04,Math.min(4.4,Math.round((value+(event.key==='-'?.05:-.05))*100)/100));
      if(mode==='edit'&&selected){
        dispatch({type:'update',sticker:transformSticker(selected,signPoleSurface(scene.surface,selected)??scene.surface,{width:resize(selected.scale[0])}),group:`${selected.id}:keyboard-size`});
      }else setSize(resize);
    };
    const key = (e: KeyboardEvent) => {
      if (exporting || !draft.ready || modelLoading || !modelAvailable || (e.target as HTMLElement).closest('input, select, textarea, [contenteditable="true"], [role="separator"]')) return;
      if(!e.metaKey&&!e.ctrlKey&&!e.altKey&&['+','=','-'].includes(e.key)){eventSize(e);return;}
      const angleLeft=['[','{','【'].includes(e.key)||e.code==='BracketLeft',angleRight=[']','}','】'].includes(e.key)||e.code==='BracketRight';
      if(!e.metaKey&&!e.ctrlKey&&!e.altKey&&(angleLeft||angleRight)){
        e.preventDefault();const turn=(degrees:number)=>((degrees+(angleLeft?5:-5)+180)%360+360)%360-180;
        if(mode==='edit'&&selected)dispatch({type:'update',sticker:transformSticker(selected,signPoleSurface(scene.surface,selected)??scene.surface,{roll:THREE.MathUtils.degToRad(turn(THREE.MathUtils.radToDeg(stickerRoll(selected))))}),group:`${selected.id}:keyboard-angle`});
        else setRotation(turn);return;
      }
      if (isOrbitKey(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); if(!e.repeat){onNavigate(); api.current?.setOrbitKey(e.key, true);} return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); dispatch({ type: e.shiftKey ? 'redo' : 'undo' }); }
      if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); dispatch({ type: 'redo' }); }
      if (e.key === 'Escape') { setActiveId('');setStickerPointerOrigin(null);setMode('view'); setHover(null); setSelectedId(null); onNavigate(); }
      if (!e.metaKey&&!e.ctrlKey&&!e.altKey&&e.code === 'KeyA') { setMode('place'); setSelectedId(null); onNavigate(); }
      if (!e.metaKey&&!e.ctrlKey&&!e.altKey&&e.code === 'KeyS') { setMode('edit');setHover(null);onNavigate(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && mode === 'edit' && selectedId) { e.preventDefault(); dispatch({ type: 'remove', id: selectedId }); }
    };
    const release = (e: KeyboardEvent) => { if((['+','=','-','[',']','{','}','【','】'].includes(e.key)||['BracketLeft','BracketRight'].includes(e.code))&&mode==='edit'&&selectedId)dispatch({type:'commit'}); if (isOrbitKey(e.key)) api.current?.setOrbitKey(e.key, false); };
    const blur = () => api.current?.stopKeyboardOrbit();
    window.addEventListener('keydown', key); window.addEventListener('keyup', release); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('keyup', release); window.removeEventListener('blur', blur); };
  }, [dispatch, mode, selectedId, selected, scene.surface, exporting, draft.ready, modelLoading, modelAvailable]);
  useEffect(() => {
    // 仅开发环境提供验证接口，读取的依然是工程数据，测试不修改 GPU 作为状态来源。
    if (import.meta.env.DEV) {
      (window as any).__stickerLab = {
        getData: () => structuredClone(scene),
        diagnostics: () => api.current?.getDiagnostics(),
        renderAtTime: (t: number | null) => api.current?.renderAtTime(t),
        rotateModel: (angle: number) => api.current?.rotateModel(angle),
        exportUSDZ: (options = { correction: 'off', target: 'keynote' }) => exportUSDZ(scene, options as any),
      };
    }
  }, [scene]);
  const selectSticker=(id:string|null)=>{onNavigate();setSelectedId(id);const sticker=scene.stickers.find(s=>s.id===id);if(sticker)api.current?.revealSticker(sticker);};
  const edit = (changes: Parameters<typeof transformSticker>[2], field: string) => {
    if (selected) dispatch({ type: 'update', sticker: transformSticker(selected,signPoleSurface(scene.surface,selected) ?? scene.surface, changes), group: `${selected.id}:${field}` });
  };
  const uploadFont=async(file?:File|'alimama'|'fangyuan')=>{
    if(!file || scene.surface.kind!=='sign')return;
    onNavigate();setFontLoading(true);setMessage('正在读取字体…');
    try {
      let selectedFile=file;
      if(typeof file==='string')throw new Error('开源版请上传自有授权字体。');
      const font=await importSignFont(selectedFile as File);dispatch({type:'sign-style',style:{font}});setMessage('字体已应用，并随工程保存；缺少的字使用默认字体。');}
    catch(error){setMessage(error instanceof Error?error.message:String(error));}
    finally{setFontLoading(false);}
  };
  const openProject = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 260 * 1024 * 1024) throw new Error('工程文件请小于 260 MB。');
      const saved = parseProject(JSON.parse(await file.text()));
      await loadSurface(saved.surface);
      await Promise.all(saved.assets.map(async a => { const image = await loadImage(a.image); if (image.width !== a.width || image.height !== a.height) throw new Error('工程图片尺寸不一致。'); }));
      origin.current = performance.now() - (Math.max(0, ...saved.stickers.map(s => s.placedAt)) + 1) * 1000;
      dispatch({ type: 'replace', scene: refreshDefaultAssets(saved) }); setSelectedId(null); setActiveId(saved.assets[0].id); setHover(null); setAutoRotate(false); setTestTime('live');
      setMessage('工程已打开，可撤销恢复之前的作品。');
    } catch (e) { setMessage(`打开失败：${e instanceof Error ? e.message : String(e)}`); }
  };
  const saveProject = async () => {
    await draft.saveNow();
    let portable:StickerSceneData;
    try{portable=await portableProject(scene);}catch(error){setMessage(error instanceof Error?error.message:String(error));return;}
    const blob = new Blob([JSON.stringify(portable)], { type: 'application/json' });
    const name = `sticker-scene-${Date.now()}.json`;
    if (import.meta.env.DEV) {
      try {
        const response = await fetch('/__validation/project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: blob });
        if (response.ok) { setProjectFile(await response.json()); setMessage('工程备份已生成，点击「下载工程文件」保存。'); return; }
      } catch { /* 普通浏览器仍可以使用 Blob 备份。 */ }
    }
    const url = URL.createObjectURL(blob); setProjectFile({ url, name }); download(blob, name);
    setMessage('工程备份已生成；也可点击「下载工程文件」保存。');
  };
  const exportTest = async (target: 'keynote' | 'freeform' = usdzTarget) => {
    setBusy(true); setExportFile(null); setMessage('正在生成独立的 USDZ 文件…');
    try {
      const bytes = await exportUSDZ(scene, { target, correction, appearance:usdzAppearance, animation:usdzAnimation?{...videoSettings,direction:scene.motion?.direction??'right'}:undefined, framing:{...videoDimensions(videoSettings),view:scene.view} }, setMessage);
      const blob = new Blob([bytes as unknown as BlobPart], { type: 'model/vnd.usdz+zip' });
      const file = {url:URL.createObjectURL(blob),name:`sticker-lab-${scene.surface.kind === 'mesh' ? 'david' : scene.surface.kind==='sign' ? 'sign' : 'pole'}-${target}-${correction}-${Date.now()}.usdz`};
      if (import.meta.env.DEV) {
        // 本地检查文件只是验证副本；保存始终使用本页 Blob，避免异步链接未触发下载。
        await fetch('/__validation/usdz', { method: 'POST', headers: { 'x-lab-target': target, 'x-lab-correction': correction }, body: blob }).catch(()=>{});
      }
      setExportFile(file); startDownload(file);
      setMessage(`USDZ 已包含 ${scene.stickers.length} 张贴纸${usdzAnimation?`及 ${videoSettings.duration} 秒循环旋转`:'，模型为静态'}，已开始下载。`);
    } catch (e) { setMessage(`导出失败：${e instanceof Error ? e.message : String(e)}`); }
    finally { setBusy(false); }
  };
  return <div data-phone-library={phonePickerOpen?'true':undefined} data-phone-device={phoneDevice?'true':undefined} data-mobile-layout={mobileLayout?'true':undefined} className={`app ${mode==='place'&&activeId&&!autoRotate?'carrying-sticker':''}`} style={{'--panel-width':`${panelWidth}px`} as React.CSSProperties}>
    <div className="panel-resizer" role="separator" aria-label="调整属性栏宽度" aria-orientation="vertical" aria-valuemin={232} aria-valuemax={600} aria-valuenow={panelWidth} tabIndex={0} onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();setPanelWidth(w=>Math.max(232,Math.min(600,w+(event.key==='ArrowLeft'?16:-16))));}}} onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))setPanelWidth(Math.max(232,Math.min(600,window.innerWidth-event.clientX)));}} onPointerUp={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}/>
    {assetMenu&&<div className="asset-context-menu" role="menu" aria-label="贴纸操作" style={{left:assetMenu.x,top:assetMenu.y}} onPointerDown={event=>event.stopPropagation()}><button role="menuitem" autoFocus disabled={assetMenu.id.startsWith('demo-')} onClick={()=>{dispatch({type:'remove-asset',id:assetMenu.id});if(activeId===assetMenu.id)setActiveId(scene.assets.find(a=>a.id!==assetMenu.id)!.id);setSelectedId(null);setHover(null);setAssetMenu(null);}}>{assetMenu.id.startsWith('demo-')?'默认贴纸不可删除':'删除贴纸'}</button></div>}
    <header className="header"><h1 className={`site-title brand-surprise ${brandRevealed?'is-revealed':''} ${brandInteracted?'has-interacted':''}`}><button className="brand-surprise-trigger" aria-label="Sticker Space" aria-expanded={brandRevealed} onClick={()=>{setBrandInteracted(true);setBrandRevealed(value=>!value);}}><span>Sticker Space</span></button></h1>
<div className="preview-model-picker"><ModelPicker scene={scene} disabled={exporting || modelLoading || !draft.ready} onChange={value=>void switchModel(value)}/></div></header>
    <main className={`workspace ${draft.ready ? '' : 'loading'}`} aria-busy={!draft.ready}>
      <RoundedCursor/><StickerFollower hidden={zooming} asset={active} size={size} rotation={rotation} origin={stickerPointerOrigin} previewPixels={carryPixels} enabled={!phoneDevice&&mode==='place'&&!autoRotate&&!exporting&&modelAvailable&&!modelLoading&&motionTime===null} onSurface={Boolean(pending)&&!zooming} surfaceCursorTransform={scale=>pending?api.current?.previewCursorTransform(pending,scale)??null:null} surfaceTransform={scale=>pending?api.current?.previewTransform(pending,scale)??null:null}/><aside className="panel">
        <div className="panel-heading"><div className="header-tools"><div className="panel-footer"><AnimatedDetails className="panel-support"><summary aria-label="工程文件与技术验证选项" title="工程文件与技术验证选项"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="m9 3 1-1h4l1 1 .4 2 2 .9 1.8-.7 2 3.5-1.5 1.4v2.4l1.5 1.4-2 3.5-1.8-.7-2 .9-.4 2-1 1h-4l-1-1-.4-2-2-.9-1.8.7-2-3.5 1.5-1.4v-2.4L2.3 8.7l2-3.5 1.8.7 2-.9Z"/><circle cx="12" cy="11.3" r="3"/></svg></summary><div className="panel-support-content">
          <AnimatedDetails className="support-item project-drawer"><summary><span>工程文件</span><span role="status" className="save-status">{draft.status}</span></summary>
            <fieldset disabled={exporting || modelLoading || !modelAvailable || !draft.ready}>
              <div className="project-tools"><div className="options"><button onClick={() => projectInput.current?.click()}>打开工程</button><button onClick={() => void saveProject()}>保存工程</button></div>{projectFile && <a href={projectFile.url} download={projectFile.name}>下载工程文件 ↗</a>}{message && <p className="action-message" role="status" aria-live="polite">{message}</p>}</div>
              <input ref={projectInput} className="visually-hidden" type="file" accept=".json,application/json" aria-label="打开工程文件" onChange={e => { void openProject(e.target.files?.[0]); e.target.value = ''; }} />
            </fieldset>
          </AnimatedDetails>
          <AnimatedDetails className="support-item tech-details"><summary>技术验证选项</summary>
            <Options label="贴合方式" value={method} choices={[{ value: 'auto', label: '自动' }, { value: 'decal', label: '平面投影' }, { value: 'conform', label: '曲面贴合' }]} onChange={setMethod} />
            <Options label="贴上动画时间" value={testTime} choices={[{ value: 'live', label: '实时' }, { value: '0', label: '0 ms' }, { value: '0.06', label: '60 ms' }, { value: '0.12', label: '120 ms' }, { value: '0.16', label: '160 ms' }]} onChange={setTestTime} />
            <button className="text-button" onClick={() => setPerformanceInfo(api.current?.getDiagnostics() ?? null)}>刷新性能统计</button>
            {performanceInfo && <output className="performance-info">已贴 {scene.stickers.length} 张 · 素材纹理 {performanceInfo.assetTextures} 张 · 渲染帧 {performanceInfo.frames}</output>}
          </AnimatedDetails>
        </div></AnimatedDetails></div></div><a className="panel-brand" href="https://github.com/" target="_blank" rel="noopener noreferrer" aria-label="项目主页">Sticker Space</a></div>
        <div className="model-import" hidden><button className="outline-button" disabled={exporting||modelLoading||!draft.ready} onClick={()=>modelInput.current?.click()} onDragOver={event=>{event.preventDefault();}} onDrop={event=>{event.preventDefault();if(exporting||modelLoading||!draft.ready)return;void modelDropFiles(event.dataTransfer).then(files=>uploadModel(files)).catch(error=>setMessage(`导入失败：${error instanceof Error?error.message:String(error)}`));}}>导入模型</button><input ref={modelInput} hidden multiple type="file" aria-label="导入自定义模型文件" onChange={event=>{void uploadModel(Array.from(event.target.files??[]));event.target.value='';}}/></div><div className="panel-scroll">
          <PropertyGroup className="background-group" label="背景">
            <div className="options background-options" role="group" aria-label="背景">{[{value:'transparent',label:'透明'},{value:'#000000',label:'黑色'},{value:'#ffffff',label:'白色'},{value:'#f0f0f0',label:'浅灰'}].map(c=><button key={c.value} className={previewBackground===c.value?'selected':''} onClick={()=>setPreviewBackground(c.value)}>{c.label}</button>)}<button className={!isImageBackground(previewBackground)&&!['transparent','#000000','#ffffff','#f0f0f0'].includes(previewBackground)?'selected':''} onClick={()=>{setPreviewBackground(customBackground);colorInput.current?.click();}}>自定义颜色</button><button className={isImageBackground(previewBackground)?'selected':''} onClick={()=>backgroundImageInput.current?.click()}>导入 JPG / PNG</button></div>
            {imageBackground&&<button className="text-button" onClick={()=>setPreviewBackground(imageBackground)}>使用已导入的图片</button>}
            <input ref={backgroundImageInput} hidden type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" aria-label="导入背景图片" onChange={e=>{const file=e.target.files?.[0];if(file)void uploadBackground(file);e.target.value='';}}/>
            <input ref={colorInput} className="background-color-input" aria-label="自定义背景颜色" type="color" value={customBackground} onChange={e=>{setCustomBackground(e.target.value);setPreviewBackground(e.target.value);}}/>
          </PropertyGroup>
          <PropertyGroup className="sticker-group" label="贴纸" defaultOpen expansionRequest={phonePickerOpen?{id:phonePickerRequest,open:true}:undefined}><fieldset className="editing-fields sticker-library" disabled={exporting || modelLoading || !modelAvailable || !draft.ready}>
              {mode !== 'edit' && <>
<AnimatedDetails className="sticker-assets imported-sticker-assets export-drawer" open expansionRequest={phonePickerOpen?{id:phonePickerRequest,open:false}:undefined}><summary><span className="sticker-heading-label">导入的贴纸</span></summary><div className="asset-grid imported-example-grid">                <input ref={input} className="visually-hidden" type="file" accept="image/png,.png" multiple aria-label="上传透明 PNG 贴纸" onChange={(e: ChangeEvent<HTMLInputElement>) => { if (e.target.files) void upload(e.target.files); e.target.value = ''; }} />
                <button aria-label="导入 PNG 贴纸" title="导入 PNG 贴纸 · 点击、拖入或粘贴，可多选" className={`asset-card upload-tile ${dragging ? 'dragging' : ''}`} onClick={() => input.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
                  onDrop={e => { e.preventDefault(); setDragging(false); if (!exporting) void upload(e.dataTransfer.files); }}>
                  <Icon name="upload" /><span className="upload-tile-label"><span>导入 PNG</span><span>贴纸</span></span>
                </button>
{scene.assets.filter(asset=>asset.id.startsWith('demo-import-')||!asset.id.startsWith('demo-')).map(asset => <button key={asset.id} className={`asset-card ${asset.id==='demo-import-monkey'?'monkey-example-card':''} ${activeId === asset.id ? 'selected' : ''}`} aria-label={`选择贴纸 ${asset.name}`} aria-pressed={activeId === asset.id}
                  onClick={event => { const image=event.currentTarget.querySelector('img')!,rect=image.getBoundingClientRect(),extent=.7*Math.min(rect.width/asset.width,rect.height/asset.height)*Math.max(asset.width,asset.height);setStickerPointerOrigin({x:event.clientX,y:event.clientY,extent});setActiveId(asset.id);if(phoneDevice)setPhoneDraftVisible(true); setMode('place'); setSelectedId(null); onNavigate();returnFromPhoneStickerPicker(); }} onContextMenu={event=>{event.preventDefault();setAssetMenu({id:asset.id,x:Math.min(event.clientX,window.innerWidth-172),y:Math.min(event.clientY,window.innerHeight-48)});}}>
                  <img src={previewImage(asset.image,true)} alt={asset.name} loading="lazy" decoding="async" />{activeId === asset.id && <span className="asset-check"><Icon name="check" size={10} /></span>}
                </button>)}</div>
</AnimatedDetails><AnimatedDetails className="sticker-assets default-sticker-assets export-drawer" open expansionRequest={phonePickerOpen?{id:phonePickerRequest,open:true}:undefined}><summary><span className="sticker-heading-label">默认的贴纸</span></summary>                <div className="asset-grid">{scene.assets.filter(asset=>asset.id.startsWith('demo-')&&!asset.id.startsWith('demo-import-')&&!asset.id.startsWith('demo-le-')&&!asset.id.startsWith('demo-steven-')&&!asset.id.startsWith('demo-daq-')&&!asset.id.startsWith('demo-shenshen-')&&!RETIRED_DEFAULT_STICKERS.has(asset.id)).map(asset => <button key={asset.id} className={`asset-card ${activeId === asset.id ? 'selected' : ''}`} aria-label={`选择贴纸 ${asset.name}`} aria-pressed={activeId === asset.id}
                  onClick={event => { const image=event.currentTarget.querySelector('img')!,rect=image.getBoundingClientRect(),extent=.7*Math.min(rect.width/asset.width,rect.height/asset.height)*Math.max(asset.width,asset.height);setStickerPointerOrigin({x:event.clientX,y:event.clientY,extent});setActiveId(asset.id);if(phoneDevice)setPhoneDraftVisible(true); setMode('place'); setSelectedId(null); onNavigate();returnFromPhoneStickerPicker(); }} onContextMenu={event=>{event.preventDefault();setAssetMenu({id:asset.id,x:Math.min(event.clientX,window.innerWidth-172),y:Math.min(event.clientY,window.innerHeight-48)});}}>
                  <img src={previewImage(asset.image,true)} alt={asset.name} loading="lazy" decoding="async" />{activeId === asset.id && <span className="asset-check"><Icon name="check" size={10} /></span>}
                </button>)}</div>
                
                <div className="asset-grid creator-sticker-grid">{scene.assets.filter(asset=>asset.id.startsWith('demo-le-')).map(asset => <button key={asset.id} className={`asset-card ${activeId === asset.id ? 'selected' : ''}`} aria-label={`选择贴纸 ${asset.name}`} aria-pressed={activeId === asset.id}
                  onClick={event => { const image=event.currentTarget.querySelector('img')!,rect=image.getBoundingClientRect(),extent=.7*Math.min(rect.width/asset.width,rect.height/asset.height)*Math.max(asset.width,asset.height);setStickerPointerOrigin({x:event.clientX,y:event.clientY,extent});setActiveId(asset.id);if(phoneDevice)setPhoneDraftVisible(true); setMode('place'); setSelectedId(null); onNavigate();returnFromPhoneStickerPicker(); }} onContextMenu={event=>{event.preventDefault();setAssetMenu({id:asset.id,x:Math.min(event.clientX,window.innerWidth-172),y:Math.min(event.clientY,window.innerHeight-48)});}}>
                  <img src={previewImage(asset.image,true)} alt={asset.name} loading="lazy" decoding="async" />{activeId === asset.id && <span className="asset-check"><Icon name="check" size={10} /></span>}
                </button>)}</div>
                
                <div className="asset-grid creator-sticker-grid">{scene.assets.filter(asset=>asset.id.startsWith('demo-steven-')&&asset.id!=='demo-steven-8').map(asset => <button key={asset.id} className={`asset-card ${activeId === asset.id ? 'selected' : ''}`} aria-label={`选择贴纸 ${asset.name}`} aria-pressed={activeId === asset.id}
                  onClick={event => { const image=event.currentTarget.querySelector('img')!,rect=image.getBoundingClientRect(),extent=.7*Math.min(rect.width/asset.width,rect.height/asset.height)*Math.max(asset.width,asset.height);setStickerPointerOrigin({x:event.clientX,y:event.clientY,extent});setActiveId(asset.id);if(phoneDevice)setPhoneDraftVisible(true); setMode('place'); setSelectedId(null); onNavigate();returnFromPhoneStickerPicker(); }} onContextMenu={event=>{event.preventDefault();setAssetMenu({id:asset.id,x:Math.min(event.clientX,window.innerWidth-172),y:Math.min(event.clientY,window.innerHeight-48)});}}>
                  <img src={previewImage(asset.image,true)} alt={asset.name} loading="lazy" decoding="async" />{activeId === asset.id && <span className="asset-check"><Icon name="check" size={10} /></span>}
                </button>)}</div>
                
                <div className="asset-grid creator-sticker-grid">{scene.assets.filter(asset=>asset.id.startsWith('demo-daq-')).map(asset => <button key={asset.id} className={`asset-card ${activeId === asset.id ? 'selected' : ''}`} aria-label={`选择贴纸 ${asset.name}`} aria-pressed={activeId === asset.id}
                  onClick={event => { const image=event.currentTarget.querySelector('img')!,rect=image.getBoundingClientRect(),extent=.7*Math.min(rect.width/asset.width,rect.height/asset.height)*Math.max(asset.width,asset.height);setStickerPointerOrigin({x:event.clientX,y:event.clientY,extent});setActiveId(asset.id);if(phoneDevice)setPhoneDraftVisible(true); setMode('place'); setSelectedId(null); onNavigate();returnFromPhoneStickerPicker(); }} onContextMenu={event=>{event.preventDefault();setAssetMenu({id:asset.id,x:Math.min(event.clientX,window.innerWidth-172),y:Math.min(event.clientY,window.innerHeight-48)});}}>
                  <img src={previewImage(asset.image,true)} alt={asset.name} loading="lazy" decoding="async" />{activeId === asset.id && <span className="asset-check"><Icon name="check" size={10} /></span>}
                </button>)}</div>
                
                <div className="asset-grid creator-sticker-grid">{scene.assets.filter(asset=>asset.id.startsWith('demo-shenshen-')).map(asset => <button key={asset.id} className={`asset-card ${activeId === asset.id ? 'selected' : ''}`} aria-label={`选择贴纸 ${asset.name}`} aria-pressed={activeId === asset.id}
                  onClick={event => { const image=event.currentTarget.querySelector('img')!,rect=image.getBoundingClientRect(),extent=.7*Math.min(rect.width/asset.width,rect.height/asset.height)*Math.max(asset.width,asset.height);setStickerPointerOrigin({x:event.clientX,y:event.clientY,extent});setActiveId(asset.id);if(phoneDevice)setPhoneDraftVisible(true); setMode('place'); setSelectedId(null); onNavigate();returnFromPhoneStickerPicker(); }} onContextMenu={event=>{event.preventDefault();setAssetMenu({id:asset.id,x:Math.min(event.clientX,window.innerWidth-172),y:Math.min(event.clientY,window.innerHeight-48)});}}>
                  <img src={previewImage(asset.image,true)} alt={asset.name} loading="lazy" decoding="async" />{activeId === asset.id && <span className="asset-check"><Icon name="check" size={10} /></span>}
                </button>)}</div>
                
                </AnimatedDetails></>}
                {!phoneDevice&&<AnimatedDetails className="sticker-size-section sticker-adjustments export-drawer" open={false}><summary><HoverHint text="试试双指滑动来改变">大小与角度</HoverHint></summary><Parameter hideValue valueHint="+-号 / 滚轮可控制" label="贴纸大小" value={mode==='edit'&&selected?selected.scale[0]:size} min={0.04} max={4.4} step={0.01} unit="m" onChange={width=>{if(mode==='edit'&&selected)edit({width},'width');else setSize(width);}} onCommit={()=>{if(mode==='edit'&&selected)dispatch({type:'commit'});}} /><Parameter hideValue valueHint={<span className="angle-key-hint"><span className="latin-angle-keys">[ ]</span><span className="angle-key-divider">/</span><span className="cjk-angle-keys">【 】可控制</span></span>} label="贴纸角度" value={mode==='edit'&&selected?-stickerRoll(selected)*180/Math.PI:-rotation} min={-180} max={180} step={1} unit="°" onChange={angle=>{if(mode==='edit'&&selected)edit({roll:-angle*Math.PI/180},'roll');else setRotation(-angle);}} onCommit={()=>{if(mode==='edit'&&selected)dispatch({type:'commit'});}} />
                </AnimatedDetails>}<AnimatedDetails className="sticker-clear-section export-drawer" open><summary>清除</summary><button className="outline-button clear-stickers-button" disabled={!scene.stickers.length} onClick={()=>{dispatch({type:'clear'});setSelectedId(null);setHover(null);setMotionTime(null);setMessage('当前模型贴纸已全部移除，可撤销恢复。');}}>全都撕掉</button></AnimatedDetails>
            </fieldset>
          <fieldset className="editing-fields" disabled={exporting || modelLoading || !modelAvailable || !draft.ready}>
            {mode === 'edit' && <div className="sticker-editor-section">
              <StickerEditor scene={scene} selected={selected} onSelect={selectSticker} onDelete={() => { if (selected) dispatch({ type: 'remove', id: selected.id }); }} />
            </div>}
          </fieldset>

          </PropertyGroup>
          <PropertyGroup className="model-group" label="模型" defaultOpen>


          {(scene.surface.kind==='cylinder'||scene.surface.kind==='sign')&&<AnimatedDetails className="model-specific-drawer export-drawer"><summary>{scene.surface.kind==='sign'?'路牌':'杆身长度'}</summary><fieldset disabled={exporting || modelLoading || !modelAvailable || !draft.ready}>{scene.surface.kind==='sign' && <SignTextControls surface={scene.surface} dispatch={dispatch} onNavigate={onNavigate} onFont={file=>void uploadFont(file)} onView={back=>{setAutoRotate(false);setHover(null);dispatch({type:'view',view:defaultModelView(scene.surface,back)});}}/>}{(scene.surface.kind==='cylinder'||scene.surface.kind==='sign')&&<PoleLengthControls surface={scene.surface} onChange={(side,length)=>{onNavigate();dispatch({type:'pole-length',side,length});}} onCommit={()=>dispatch({type:'commit'})}/>}</fieldset></AnimatedDetails>}
          <AnimatedDetails className="model-tilt-drawer export-drawer"><summary>倾斜</summary><fieldset disabled={exporting||modelLoading||!modelAvailable||!draft.ready}><Parameter label="旋转轴倾斜" value={scene.modelTilt??0} min={-90} max={90} step={1} unit="°" onChange={angle=>{setHover(null);dispatch({type:'model-tilt',angle,group:'model-tilt'});}} onCommit={()=>dispatch({type:'commit'})}/><button className="text-button" onClick={()=>dispatch({type:'model-tilt',angle:0})}>恢复垂直</button></fieldset></AnimatedDetails>
          <ModelColorControls value={scene.modelColor} disabled={exporting || modelLoading || !modelAvailable || !draft.ready} onChange={(modelColor,group)=>{onNavigate();dispatch({type:'model-color',modelColor,group});}} onCommit={()=>dispatch({type:'commit'})}/>
          <LightingControls surface={scene.surface} value={scene.lighting} disabled={exporting || modelLoading || !modelAvailable || !draft.ready} onChange={(lighting,group)=>{onNavigate();dispatch({type:'lighting',lighting,group});}} onCommit={()=>dispatch({type:'commit'})}/>
          <div className="animation-section"><AnimationControls period={videoSettings.duration} onPeriodChange={duration=>{setVideoSettings(value=>({...value,duration}));dispatch({type:'motion',motion:{...(scene.motion??DEFAULT_MOTION),turnDuration:duration},group:'motion-settings'});}} scene={scene} time={motionTime} playing={motionPlaying} disabled={exporting || modelLoading || !modelAvailable || !draft.ready} onChange={motion=>{setVideoSettings(value=>({...value,duration:motion.turnDuration}));onNavigate();setHover(null);dispatch({type:'motion',motion,group:'motion-settings'});if(motion.mode==='sequence'){api.current?.resetCamera();setAutoRotate(false);setMotionTime(0);setMotionPlaying(true);}else{setAutoRotate(true);}}} onTime={setMotionTime} onPlaying={playing=>{if(playing&&(motionTime===null||motionTime>=motionPlan(scene.stickers,scene.motion??DEFAULT_MOTION).duration))api.current?.resetCamera();setMotionPlaying(playing);}} onCommit={()=>dispatch({type:'commit'})}/></div>
          <FloatingControls value={scene.floating} period={videoSettings.duration} disabled={exporting||modelLoading||!modelAvailable||!draft.ready} onChange={(floating,group)=>{dispatch({type:'floating',floating,group});setHover(null);}} onPeriodChange={duration=>{setVideoSettings(value=>({...value,duration}));dispatch({type:'motion',motion:{...(scene.motion??DEFAULT_MOTION),turnDuration:duration},group:'motion-settings'});}} onCommit={()=>dispatch({type:'commit'})}/>
            </PropertyGroup><PropertyGroup className="export-group" label="导出" defaultOpen>
          <div className="export-first">{phoneDevice?<MobileVideoExport background={previewBackground} ready={draft.ready && !modelLoading && modelAvailable && !busy && !fontLoading && !liveRunning} scene={scene} settings={videoSettings} onChange={changeVideoSettings} onRunning={onVideoRunning}/>: <VideoExport background={previewBackground} ready={draft.ready && !modelLoading && modelAvailable && !busy && !fontLoading && !liveRunning} scene={scene} settings={videoSettings} onChange={changeVideoSettings} onRunning={onVideoRunning} />}</div>
          {!isAndroidDevice(navigator.userAgent)&&<div className="export-row">{isAppleTouchDevice(navigator.userAgent,navigator.maxTouchPoints)?<MobileVideoExport livePhoto background={previewBackground} ready={draft.ready && !modelLoading && modelAvailable && !exporting} scene={scene} settings={videoSettings} onChange={changeVideoSettings} onRunning={onVideoRunning}/>:<LivePhotoExport onBackgroundChange={setPreviewBackground} onCustomBackground={()=>{setPreviewBackground(customBackground);colorInput.current?.click();}} onVideoChange={changeVideoSettings} background={previewBackground} scene={scene} video={videoSettings} ready={draft.ready && !modelLoading && modelAvailable && !exporting} onRunning={setLiveRunning}/>}</div>}
          {!isAndroidDevice(navigator.userAgent)&&<AnimatedDetails className="export-row usdz-export export-drawer" open={false}>
            <summary>模型 · USDZ</summary>
            <label className="checkbox"><input type="checkbox" disabled={exporting} checked={usdzAppearance} onChange={e=>setUsdzAppearance(e.target.checked)} />偏色补偿</label>
            <label className="checkbox">打开应用 <select aria-label="USDZ 打开应用" disabled={exporting} value={usdzTarget} onChange={e=>setUsdzTarget(e.target.value as 'freeform'|'keynote')}><option value="freeform">无边记</option><option value="keynote">Keynote</option></select></label>
            <label className="checkbox"><input type="checkbox" disabled={exporting} checked={usdzAnimation} onChange={e=>setUsdzAnimation(e.target.checked)} />动画</label>
            <button className="export-button" disabled={exporting || modelLoading || !modelAvailable || !draft.ready} onClick={() => void exportTest()}>{busy ? '正在生成…' : '导出 USDZ'}</button>
          </AnimatedDetails>}
          </PropertyGroup>
        </div>

        <div className="panel-bottom-accessories"><div className="preview-help-wrap"><span className="preview-help-label">摆弄模型的技巧</span><AnimatedDetails className="preview-help" dismissOnOutside><summary aria-label="模型操作提示"><svg width="17.6" height="17.6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9 8a3 3 0 0 1 6 0c0 2-3 2-3 4"/><circle cx="12" cy="16.5" r="1.1" fill="currentColor" stroke="none"/></svg></summary><div className="preview-help-content">{phoneDevice?<><p>单指拖动旋转模型；双指捏合缩放模型，在贴、撕和预览时都能用</p><p>贴纸：选中素材或已贴的贴纸后，用预览区上方的调节杆调整大小和角度；贴完后调整最后一张贴纸</p><p>按住预览区左下角圆钮，拖动以移动模型；松手后圆钮弹回，模型保留位置</p></>:<><p>旋转模型：方向键↑↓←→ / 三指拖拽</p><p>编辑时：在贴纸上拖拽撕开，在模型裸露处或模型外拖拽旋转，完整撕开贴纸再移动，模型上松手贴回，空白处松手由猫爪扒走</p><p>推拉模型：Command+双指滑动触控板 / 鼠标滚轮</p><p>平移模型：Command+鼠标或触控板拖拽</p><p>（触控板也可以直接缩放）</p></>}</div></AnimatedDetails></div><span className="version panel-version">261015X320</span></div>
      </aside>
      <section className={`stage ${mode==='edit'&&!autoRotate?'peel-mode':''} ${mode === 'place' && !autoRotate ? `placement-mode ${hover&&!zooming?'surface-cursor-active':''}` : ''}`} aria-label="交互式三维贴纸模型" tabIndex={-1}><PeelCredit revealed={mode==='edit'&&!autoRotate}><button className="theme-toggle" aria-label={theme==='dark'?'切换亮色模式':'切换暗色模式'} title={theme==='dark'?'亮色模式':'暗色模式'} onClick={toggleTheme}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{theme==='dark'?<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>:<path d="M20 15.5A9 9 0 0 1 8.5 4 9 9 0 1 0 20 15.5Z"/>}</svg></button></PeelCredit>
        <MobileStickerControls phone={phoneDevice} size={phoneTarget?.scale[0]??size} angle={phoneTarget?-stickerRoll(phoneTarget)*180/Math.PI:-rotation} disabled={exporting||modelLoading||!modelAvailable||!draft.ready||autoRotate||motionTime!==null||mode==='view'||(mode==='edit'&&!phoneTarget)}
          onSize={width=>adjustPhoneSticker({width})} onAngle={angle=>adjustPhoneSticker({angle})} onCommit={commitPhoneSticker}/>
        <PreviewFrame mobile={mobileLayout} aspect={videoSettings.aspect} background={previewBackground}>
          {draft.ready && <Scene phoneDevice={phoneDevice} onPreviewReady={setPreviewReady} motionTime={motionTime} data={previewScene} pending={exporting || !modelAvailable ? null : pending} hidePending={zooming} onZoom={setZooming} activeId={active.id} autoRotate={autoRotate} rotationPeriod={videoSettings.duration} paused={exporting || !modelAvailable || modelLoading || motionTime!==null} onNavigate={onNavigate} onHover={hit => { if (mode === 'place' && !exporting && modelAvailable && !modelLoading) setHover(hit); }} onPlace={hit => { if (!exporting && modelAvailable && !modelLoading && motionTime===null && (!(phoneDevice&&phoneDraftVisible)||phoneDropping.current)) place(hit); }} api={api} now={now}
            onTouchStickerSelect={id=>setSelectedId(id)}
            editable={motionTime===null && mode === 'edit' && !autoRotate && !exporting && modelAvailable && !modelLoading} selectedId={selectedId} onSelect={selectSticker}
            onMove={(id, hit) => { const s = scene.stickers.find(s => s.id === id); if (s) {const support=signPoleSurface(scene.surface,{position:hit.position,normal:hit.normal}) ?? scene.surface;dispatch({ type: 'update', sticker: support.kind !== 'cylinder' ? {...s,position:hit.position,normal:hit.normal,rotation:orientation(hit.normal,stickerRoll(s)).toArray().slice(0,3) as [number,number,number]} : transformSticker(s, support, { angle: Math.atan2(hit.position[0], hit.position[2]), y: hit.position[1] }), group: `${id}:drag` });} }}
            onRemove={id => { dispatch({type:'remove',id});setSelectedId(value=>value===id?null:value);setMessage('贴纸丢掉了，可以撤销恢复。'); }} onCommit={() => dispatch({ type: 'commit' })} onViewChange={view => { if(modelAvailable && !modelLoading) dispatch({ type: 'view', view }); }} />}
          <MobileDraftSticker onDrop={(x,y)=>{phoneDropping.current=true;try{return api.current?.dropDraft(x,y)??false;}finally{phoneDropping.current=false;}}} enabled={phoneDevice&&phoneDraftVisible&&mode==='place'&&modelAvailable&&!modelLoading&&!autoRotate&&!exporting&&motionTime===null&&previewReady===modelKey} asset={active} dimensions={()=>{
            const pixels=api.current?.draftPixelScale();if(!pixels)return null;
            const preferences=phoneDraftSettings.current,scale=fittedScale(preferences.size,active.width/active.height,0,scene.surface);
            return {width:scale[0]*pixels,height:scale[1]*pixels,angle:preferences.angle};
          }}/>
          <MobileModelPan phone={phoneDevice} disabled={exporting||modelLoading||!modelAvailable||!draft.ready||motionTime!==null} onStart={()=>{onNavigate();api.current?.beginModelPan();}} onMove={(dx,dy)=>api.current?.panModel(dx,dy)} onEnd={()=>api.current?.endModelPan()}/>
          <MobileStickerPicker phone={phoneDevice} disabled={exporting||modelLoading||!modelAvailable||!draft.ready} onClick={openPhoneStickerPicker}/>
          <ApertureLoading onClosed={onApertureClosed} busy={apertureBusy} error={modelError} onRetry={()=>setModelRetry(v=>v+1)}/>
        </PreviewFrame>
        <button className="preview-reset" disabled={exporting} aria-label="重置视角" title="重置视角" onClick={() => { api.current?.resetCamera(); setAutoRotate(false); setHover(null); }}><Icon name="reset" size={12} /></button>
        <fieldset className="canvas-toolbar" disabled={exporting}>
          <HoverHint disabled={phoneDevice} text="空格👉播放或暂停"><button className={autoRotate||motionPlaying ? 'is-active' : ''} aria-label={autoRotate||motionPlaying ? '暂停' : '播放'} onClick={togglePlayback}><Icon name={autoRotate||motionPlaying ? 'pause' : 'play'} /></button></HoverHint>
          <button className={mode === 'view' && !autoRotate ? 'is-active' : ''} aria-label="预览模型" title="预览 · Esc" onClick={() => { setMode('view'); setHover(null); onNavigate(); }}><Icon name="eye" /></button>
          <span className="toolbar-divider" />
          <button className={mode === 'place' && !autoRotate ? 'is-active' : ''} aria-label="贴贴纸" title="贴 · A" onClick={() => { if(phoneDevice)setPhoneDraftVisible(true);setMode('place'); setSelectedId(null); onNavigate(); }}><span className="place-sticker-icon" aria-hidden="true" style={{maskImage:`url(${placeStickerIcon})`,WebkitMaskImage:`url(${placeStickerIcon})`}}/><span>贴</span></button>
          <button className={mode === 'edit' && !autoRotate ? 'is-active' : ''} aria-label="撕贴纸" title="撕 · S" onClick={() => { setMode('edit'); setHover(null); onNavigate(); }}><Icon name="sticker" /><span>撕</span></button>
        </fieldset>


      </section>
    </main>
  </div>;
}
