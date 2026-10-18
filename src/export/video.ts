import {applyModelMotion,floatingRadius} from '../core/floating';
import {isImageBackground,drawExportBackground} from '../core/background';
import {loadImage} from '../core/assets';
import {withStableSubpixelSampling} from './stableSampling';
import {prepareExportTextureSampling} from './textureSampling';
import {modelOrbitPivot} from '../core/modelOrbit';
import {resolveLighting} from '../core/modelLighting';
import * as THREE from 'three';
import {motionPlan} from '../core/motion';
import type { StickerSceneData } from '../core/types';
import { buildSceneSnapshot, disposeSnapshot } from './pipeline';
import { applyStudioLighting, addStudioLights } from '../scene/lighting';
import { videoDimensions, videoFrameCount, videoRenderScale, turntableAngle, type VideoFormat, type VideoSettings } from './videoSettings';
import { detectNativeExporter, startNativeExport, createNativeFrameQueue, finishNativeExport, cancelNativeExport, type NativeSession } from './nativeVideo';
export type VideoProgress = { value: number; label: string };
export type VideoResult = { url: string; name: string };
export class HelperRequiredError extends Error {}
// 独立副本与逐帧绝对时间；导出分辨率不依赖屏幕 DPR 或实时渲染速度。
export async function createVideoRenderer(data: StickerSceneData, settings: VideoSettings, sampling:1|2 = 2, options:{background?:string;stableSampling?:boolean;boundedEncoding?:boolean} = {}) {
  const backgroundImage=options.background&&isImageBackground(options.background)?await loadImage(options.background):undefined;
  const totalFrames=videoFrameCount(settings,options.boundedEncoding);
  const root = await buildSceneSnapshot(data), scene = new THREE.Scene(); scene.add(root);
  const floatRadius=data.floating?.enabled?floatingRadius(data.surface):0;
  const { width, height } = videoDimensions(settings);
  let renderer: THREE.WebGLRenderer | undefined, release = () => {}, lights: ReturnType<typeof addStudioLights> | undefined;
  const dispose = () => { release(); lights?.dispose(); disposeSnapshot(root); renderer?.dispose(); renderer?.forceContextLoss(); };
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    prepareExportTextureSampling(root,renderer.capabilities.getMaxAnisotropy());
    const context=renderer.getContext();
    const allowedScale=videoRenderScale(width,height,Math.min(context.getParameter(context.MAX_RENDERBUFFER_SIZE),context.getParameter(context.MAX_TEXTURE_SIZE)));
    const scale=sampling===1?1:allowedScale;
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.setPixelRatio(scale); renderer.setSize(width, height, false); renderer.setClearColor(0x000000, 0);
    const output=document.createElement('canvas'); output.width=width; output.height=height;
    const pixels=output.getContext('2d'); if(!pixels)throw new Error('无法创建视频输出画布');
    pixels.imageSmoothingEnabled=true; pixels.imageSmoothingQuality='high';
    const stable=Boolean(options.stableSampling&&options.background);
    const sampleCanvas=stable?document.createElement('canvas'):output;sampleCanvas.width=width;sampleCanvas.height=height;
    const samplePixels=sampleCanvas.getContext('2d');if(!samplePixels)throw new Error('无法创建高质量采样画布');
    samplePixels.imageSmoothingEnabled=true;samplePixels.imageSmoothingQuality='high';
    if(stable)renderer.shadowMap.autoUpdate=false;
    const camera = new THREE.PerspectiveCamera(39, width / height, 0.1, 100);
    camera.position.fromArray(data.view?.position ?? [0, 0.18, 8.8]); camera.lookAt(new THREE.Vector3().fromArray(data.view?.target ?? [0, 0, 0]));
    camera.zoom = data.view?.zoom ?? 1; camera.updateProjectionMatrix();
    release = applyStudioLighting(scene, renderer,resolveLighting(data.lighting,data.surface)); lights = addStudioLights(scene, data.surface.kind === 'mesh',data.surface.kind==='sign',resolveLighting(data.lighting,data.surface),data.surface.height); lights.update(camera);
    await renderer.compileAsync(scene, camera);
    const gl = renderer;
    const sequence=settings.motion?.mode==='sequence';
    const plan=motionPlan(data.stickers,settings.motion??data.motion);
    const animated: {data:typeof data.stickers[number];attached:THREE.Mesh;flyer:THREE.Mesh}[]=[];
    if(sequence)for(const sticker of data.stickers){
      const attached=root.getObjectByName(`Sticker_${sticker.id}`) as THREE.Mesh;
      const flyer=new THREE.Mesh(new THREE.PlaneGeometry(...sticker.scale),attached.material);
      flyer.renderOrder=attached.renderOrder;attached.parent!.add(flyer);animated.push({data:sticker,attached,flyer});
    }
    const drawAtTime=(time:number)=>{
        applyModelMotion(root,data.motion?.enabled===false?0:sequence?plan.at(time).angle:turntableAngle(time,totalFrames/settings.fps)*((data.motion?.direction??'right')==='right'?-1:1),modelOrbitPivot(data.surface),data.modelTilt??0,data.floating,time,totalFrames/settings.fps,floatRadius);
        for(const entry of animated){
          const pose=plan.pose(entry.data.id,time),s=entry.data;
          entry.attached.visible=pose.visible&&pose.complete;entry.flyer.visible=pose.visible&&!pose.complete;
          entry.flyer.position.set(s.position[0]+s.normal[0]*(pose.distance+.008),s.position[1]+s.normal[1]*(pose.distance+.008),s.position[2]+s.normal[2]*(pose.distance+.008));
          entry.flyer.rotation.set(...s.rotation);entry.flyer.rotateX(pose.tilt);entry.flyer.scale.setScalar(pose.scale);
        }
        lights!.update(camera);
        pixels.clearRect(0,0,width,height);
        const drawSample=(index:number)=>{
          gl.render(scene,camera);
          samplePixels.clearRect(0,0,width,height);
          drawExportBackground(samplePixels,options.background,backgroundImage,width,height);
          samplePixels.drawImage(gl.domElement,0,0,width,height);
          if(stable){pixels.globalAlpha=1/(index+1);pixels.drawImage(sampleCanvas,0,0);}
        };
        if(stable){
          // Camera jitter does not move the model or lights: compute shadows once for all four samples.
          gl.shadowMap.needsUpdate=true;
          try{withStableSubpixelSampling(camera,gl.domElement.width,gl.domElement.height,index=>drawSample(index));}
          finally{pixels.globalAlpha=1;}
        }else drawSample(0);
        return output;
      };
    const renderAtTime=(time:number)=>{drawAtTime(time);return new Promise<Blob>((resolve,reject)=>output.toBlob(blob=>blob?resolve(blob):reject(new Error('无法读取透明 PNG 帧')),'image/png'));};
    return {
      canvas:output,drawAtTime,
      render: (frame:number)=>renderAtTime(frame/settings.fps),
      renderAtTime,
      dispose,
    };
  } catch (error) { dispose(); throw error; }
}
export async function exportVideo(data: StickerSceneData, settings: VideoSettings, format: VideoFormat, signal: AbortSignal, progress: (value: VideoProgress) => void, browserOnly = false, background = 'transparent'): Promise<VideoResult> {
  const total = videoFrameCount(settings), name = `sticker-lab-${format === 'hevc' ? 'hevc-alpha' : 'prores4444'}-${Date.now()}.mov`;
  let native: NativeSession | null = null;
  let queue: ReturnType<typeof createNativeFrameQueue> | undefined;
  let browser: Awaited<ReturnType<typeof import('./browserVideo')['createBrowserProResEncoder']>> | undefined;
  let render: Awaited<ReturnType<typeof createVideoRenderer>> | undefined;
  try {
    progress({ value: 0, label: '连接编码器…' });
    const caps = browserOnly ? null : await detectNativeExporter(format, signal); signal.throwIfAborted();
    if(caps && total>(caps.maxFrames??1800))throw new HelperRequiredError('这段动画超过旧助手的帧数上限，请更新并重启 macOS 助手 0.4.0。');
    if(format==='hevc' && caps && !caps.highQualityHevc)throw new HelperRequiredError('请更新并重启 macOS 助手，以使用高画质 HEVC Alpha。');
    if (caps) { native = await startNativeExport(caps, format, settings.fps, total, name, signal,settings); queue = createNativeFrameQueue(native, signal); }
    else {
      if (format === 'hevc') throw new HelperRequiredError('尚未连接饼饼导出助手，请先启动助手。');
      progress({ value: 0, label: '加载浏览器编码器…' });
      const { createBrowserProResEncoder } = await import('./browserVideo');
      browser = await createBrowserProResEncoder(settings.fps, total, signal, value => progress({ value: 0.7 + value * 0.29, label: '浏览器编码 MOV…' }));
    }
    const path = native ? '本机' : '浏览器';
    progress({ value: 0, label: `${path}导出 · 准备 3D 场景…` });
    render = await createVideoRenderer(data, settings, 2, {background:background==='transparent'?undefined:background}); signal.throwIfAborted();
    for (let frame = 0; frame < total; frame++) {
      signal.throwIfAborted(); const blob = await render.render(frame); signal.throwIfAborted();
      if (queue) await queue.append(blob); else await browser!.addFrame(frame, blob);
      progress({ value: (frame + 1) / total * (native ? 0.96 : 0.7), label: `${path}导出 · ${frame + 1} / ${total} 帧` });
      if (frame % 3 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    render.dispose(); render = undefined;
    if (native && queue) {
      await queue.finish(); progress({ value: 0.97, label: '本机导出 · 完成编码…' });
      const output = await finishNativeExport(native, signal); native = null;
      // 先读取本机结果，转成本页 Blob 再自动下载。跨域 localhost 的链接在部分
      // 内嵌浏览器只接受真实点击，异步 click 不会保存；Blob 也保留正确文件名。
      progress({value:.99,label:'保存到电脑…'});
      const response=await fetch(output.downloadUrl,{signal});
      if (!response.ok) throw new Error(`读取本机视频失败 (${response.status})`);
      const blob=await response.blob(); signal.throwIfAborted();
      return {url:URL.createObjectURL(blob),name:output.outputName};
    }
    progress({ value: 0.7, label: '浏览器编码 MOV…' });
    const blob = await browser!.finish(); signal.throwIfAborted();
    if (import.meta.env.DEV) {
      await fetch('/__validation/video', { method: 'POST', body: blob, signal }).catch(()=>{signal.throwIfAborted();});
    }
    return {url:URL.createObjectURL(blob),name};
  } finally { await queue?.cancel(); if (native) cancelNativeExport(native); browser?.dispose(); render?.dispose(); }
}
