import {applyModelMotion,floatingPose,floatingRotation,floatingRadius} from '../core/floating';
import {waitForPreview} from './previewReadiness';
import {draftStickerPixelScale} from './draftStickerSize';
import {InteractiveStickerPreview} from './InteractiveStickerPreview';
import {TouchNavigation,CANCEL_TOUCH_STICKER} from '../core/touchNavigation';
import {resolveLighting} from '../core/modelLighting';
import {modelHit,modelGeometry} from '../core/modelSurface';
import {prepareSurfaceWrap} from '../core/surfaceWrap';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, events, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { addStudioLights, applyStudioLighting } from './lighting';
import {framedModelView,isLegacyExampleView} from '../core/modelFraming';
import {movingPreviewDpr} from './previewResolution';
import { zoomView, panView } from '../core/viewNavigation';
import { modelOrbitPivot, modelSpinAxis, rotateViewAroundModel } from '../core/modelOrbit';
import { stepKeyboardOrbit, type OrbitKey } from '../core/keyboardOrbit';
import { clearOrbitDamping } from '../core/orbitDamping';
import {motionPlan} from '../core/motion';
import { turntableAngle } from '../export/videoSettings';
import {PreviewGeometryCache} from './PreviewGeometryCache';
import { StickerSurface } from './StickerSurface';
import { Sticker } from './Sticker';
import {stickerOverlayTransform} from './stickerOverlay';
import {sortStickerIntersections} from '../core/stickerVisibility';
import { assetTextures } from './assetTextures';
import type { CameraView, Placement, StickerData, StickerSceneData, SurfaceData } from '../core/types';

export type SceneAPI = {
  resetCamera: () => void;
  previewStickerEdit:(sticker:StickerData)=>void;finishStickerEdit:(sticker:StickerData)=>void;cancelStickerEdit:()=>void;
  beginModelPan:()=>void;panModel:(dx:number,dy:number)=>void;endModelPan:()=>void;
  dropDraft:(x:number,y:number)=>boolean;
  draftPixelScale:()=>number;
  previewPixels:(x:number,y:number,extent:number)=>number;
  previewTransform:(data:StickerData,scale:number)=>string|null;
  previewCursorTransform:(data:StickerData,scale:number)=>string|null;
  revealSticker: (sticker: StickerData) => void;
  freezeAutoRotation: () => void;
  setOrbitKey: (key: OrbitKey, pressed: boolean) => void;
  stopKeyboardOrbit: () => void;
  renderAtTime: (time: number | null) => void;
  rotateModel: (angle: number) => void;
  defaultView: (surface?:SurfaceData) => CameraView;
  getDiagnostics: () => { meshes: number; stickers: number; triangles: number; assetTextures: number; frames: number };
};
type Props = {
  phoneDevice?:boolean;
  onTouchStickerSelect?:(id:string)=>void;
  onPreviewReady?:(key:string)=>void;hidePending?:boolean;onZoom?:(active:boolean)=>void; motionTime?:number|null; data: StickerSceneData; pending: StickerData | null; activeId: string;
  autoRotate: boolean; rotationPeriod: number; paused: boolean; onNavigate: () => void; onHover: (p: Placement | null) => void;
  onPlace: (p: Placement) => void; api: React.MutableRefObject<SceneAPI | null>;
  now: () => number;
  editable: boolean; selectedId: string | null; onSelect: (id: string | null) => void;
  onMove: (id: string, hit: Placement) => void; onCommit: () => void; onRemove: (id: string) => void;
  onViewChange: (view: NonNullable<StickerSceneData['view']>) => void;
};

function World(props: Props) {
  const { scene, gl, camera: activeCamera, invalidate,events:pointerEvents,size,viewport,setDpr } = useThree();
  const camera = activeCamera as THREE.PerspectiveCamera;
  useEffect(()=>{
    let cancelled=false,frame=0;
    const key=props.data.surface.id+(props.data.surface.kind==='sign'?':'+(props.data.surface.font?.id??'default'):'');
    const prepare=async()=>{
      const nextFrame=()=>new Promise<void>(resolve=>{frame=requestAnimationFrame(()=>resolve());});
      // The other effects install the environment and lights. Compiling before
      // they run warms a different shader from the one used by the first frame.
      await nextFrame();
      if(cancelled)return;
      // Fit against the mounted portrait canvas, before opening the loading iris.
      if((!props.data.view||isLegacyExampleView(props.data.view))&&controls.current){
        const rect=gl.domElement.getBoundingClientRect(),view=framedModelView(props.data.surface,rect.width/Math.max(1,rect.height),camera.fov);
        camera.position.fromArray(view.position);camera.zoom=view.zoom??1;camera.updateProjectionMatrix();
        controls.current.target.fromArray(view.target);controls.current.update();savedView.current=view;
        currentProps.current.onViewChange(view);invalidate();
      }
      if(props.phoneDevice&&(props.data.surface.kind==='custom'||props.data.surface.kind==='mesh'))prepareSurfaceWrap(modelGeometry(props.data.surface));
      // Texture hooks mount saved sticker meshes asynchronously. Keep the iris
      // closed until those meshes exist, then warm their GPU programs.
      const expected=props.data.stickers.length;
      await waitForPreview(()=>{
        let count=0;scene.traverse(object=>{if(object instanceof THREE.Mesh&&object.name.startsWith('sticker-'))count++;});
        return count>=expected;
      },nextFrame,()=>cancelled,3000);
      if(cancelled)return;
      // Render below compiles the exact transmission/shadow variants that are
      // actually used. compileAsync polls mutable currentProgram references and
      // can leave navigation waiting forever on some graphics drivers.
      if(cancelled)return;
      // Submit the complete frame while the iris is still closed, then wait for
      // the GPU without blocking the UI thread with finish().
      gl.shadowMap.needsUpdate=true;
      gl.render(scene,camera);
      const context=gl.getContext();
      if(context instanceof WebGL2RenderingContext){
        const fence=context.fenceSync(context.SYNC_GPU_COMMANDS_COMPLETE,0);
        context.flush();
        if(fence){
          try{await waitForPreview(()=>context.clientWaitSync(fence,0,0)!==context.TIMEOUT_EXPIRED,nextFrame,()=>cancelled,1500);}
          finally{context.deleteSync(fence);}
        }
      }
      // Wait for a short run of settled frames after GPU preparation. Reset on a
      // long frame instead of opening into pending layout / asset work.
      let stable=0,last=performance.now();const settleStarted=last;
      invalidate();
      while(stable<8&&!cancelled&&performance.now()-settleStarted<1200){
        await nextFrame();const now=performance.now();
        stable=now-last<40?stable+1:0;last=now;
      }
      if(!cancelled){if(import.meta.env.DEV){const mark=performance.getEntriesByName('sticker-lab-switch').at(-1) as PerformanceMark|undefined;if(mark?.detail===props.data.surface.id)console.info('Model fully ready',key,Math.round(performance.now()-mark.startTime),'ms');}props.onPreviewReady?.(key);}
    };
    void prepare().catch(()=>{if(!cancelled){invalidate();frame=requestAnimationFrame(()=>props.onPreviewReady?.(key));}});
    return()=>{cancelled=true;};
  },[props.data.surface,gl,scene,camera,invalidate,props.onPreviewReady]);

  const animation=useMemo(()=>motionPlan(props.data.stickers,props.data.motion),[props.data.stickers,props.data.motion]);
  useEffect(()=>{gl.shadowMap.needsUpdate=true;invalidate();},[props.motionTime,props.data.modelTilt,props.data.floating,invalidate,gl]);
  const currentProps = useRef(props); currentProps.current = props;
  const panGesture = useRef<{ pointer: number; x: number; y: number } | null>(null);
  const viewTimer = useRef<ReturnType<typeof setTimeout>>();
  const savedView = useRef<StickerSceneData["view"]>();
  const draftProjection=useRef({camera:new THREE.Matrix4(),projection:new THREE.Matrix4(),root:new THREE.Matrix4(),geometry:null as THREE.BufferGeometry|null,height:0,pixels:0});
  const controls = useRef<React.ElementRef<typeof OrbitControls>>(null), root = useRef<THREE.Group>(null);
  const overrideTime = useRef<number | null>(null), timeline = useRef({ current: 0, manual: false }), frames = useRef(0);
  const keyboardOrbit = useRef({ keys: new Set<OrbitKey>(), velocity: { x: 0, y: 0 }, active: false, pivot:new THREE.Vector3() });
  const reveal = useRef<{elapsed:number;target:THREE.Vector3;pivot:THREE.Vector3;offset:THREE.Vector3;rotation:THREE.Quaternion}|null>(null);
  const touchActive=useRef(false),modelPanButton=useRef(false);
  const pointerOrbit=useRef<{pointer:number;x:number;y:number;active:boolean;pivot:THREE.Vector3}|null>(null);
  const rootAngle=useRef(0),floatClock=useRef(0);
  const rotationPivot=()=>modelOrbitPivot(currentProps.current.data.surface);
  const setRootAngle=(angle:number)=>{
    if(!root.current)return;
    rootAngle.current=angle;
    applyModelMotion(root.current,angle,rotationPivot(),currentProps.current.data.modelTilt??0,currentProps.current.data.floating,overrideTime.current??currentProps.current.motionTime??floatClock.current,currentProps.current.rotationPeriod,currentProps.current.data.floating?.enabled?floatingRadius(currentProps.current.data.surface):0);
  };
  const stopKeyboardOrbit = () => {
    reveal.current=null;
    const orbit = keyboardOrbit.current;
    orbit.keys.clear(); orbit.velocity = { x: 0, y: 0 };
    if (orbit.active) { orbit.active = false; if(controls.current)controls.current.enabled=!currentProps.current.paused&&!draggingSticker.current&&modelPointer.current===null&&!pointerOrbit.current&&!touchActive.current; saveView(); }
  };
  useEffect(() => {
    // 切换模型时使用各自的镜头记录，丢弃旧手势，避免把旧镜头写进新模型。
    const orbit = keyboardOrbit.current;
    orbit.keys.clear(); orbit.velocity = {x:0,y:0}; orbit.active = false;pointerOrbit.current=null;
    if(controls.current)controls.current.enabled=!props.paused&&!draggingSticker.current&&modelPointer.current===null&&!pointerOrbit.current&&!touchActive.current;
    clearTimeout(viewTimer.current);
  }, [props.paused, props.data.surface.id]);
  useEffect(() => {
    if (props.autoRotate) {
      const orbit = keyboardOrbit.current;
      orbit.keys.clear(); orbit.velocity = {x:0,y:0}; orbit.active = false;
      if(controls.current)controls.current.enabled=!props.paused&&!draggingSticker.current&&modelPointer.current===null&&!pointerOrbit.current&&!touchActive.current;
    }
  }, [props.autoRotate]);
  useEffect(()=>{
    if(!import.meta.env.DEV)return;
    const mark=performance.getEntriesByName('sticker-lab-switch').at(-1) as PerformanceMark|undefined;
    if(mark?.detail!==props.data.surface.id)return;
    let second=0;
    const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>console.info('Model switch ready',props.data.surface.kind,Math.round(performance.now()-mark.startTime),'ms'));});
    return ()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
  },[props.data.surface.id]);
  const [geometryCache]=useState(()=>new PreviewGeometryCache());
  const [interactiveSticker]=useState(()=>new InteractiveStickerPreview(id=>root.current?.getObjectByName(`sticker-${id}`) as THREE.Mesh|undefined,invalidate,callback=>requestAnimationFrame(callback),id=>cancelAnimationFrame(id)));
  useEffect(()=>()=>interactiveSticker.cancel(),[interactiveSticker]);
  useEffect(()=>{geometryCache.prune(props.data);},[geometryCache,props.data]);
  useEffect(()=>()=>geometryCache.dispose(),[geometryCache]);
  // Load only the active model's placed images; other models fetch on selection.
  const retainedAssets=useMemo(()=>{
    const ids=new Set(props.data.stickers.map(s=>s.assetId));
    return props.data.assets.filter(a=>ids.has(a.id));
  },[props.data.assets,props.data.stickers]);
  useEffect(()=>{const releases=retainedAssets.map(a=>assetTextures.acquire(a.image,()=>{}));return ()=>releases.forEach(release=>release());},[retainedAssets]);
  const environment=useRef<ReturnType<typeof applyStudioLighting>|null>(null);
  const studioLights = useRef<ReturnType<typeof addStudioLights> | null>(null);
  const shadowView=useRef({position:new THREE.Vector3(Infinity,0,0),rotation:new THREE.Quaternion(),angle:Infinity});
  const lastPreviewMotion=useRef(0);
  useEffect(()=>{
    gl.shadowMap.autoUpdate=false;gl.shadowMap.needsUpdate=true;
    return()=>{gl.shadowMap.autoUpdate=true;};
  },[gl]);
  const rotationClock = useRef({ elapsed: 0, last: performance.now() });
  const draggingSticker=useRef<string|null>(null);
  const modelPointer=useRef<number|null>(null);
  const dragState = (dragging: boolean,id:string) => {
    if(dragging){stopKeyboardOrbit();reveal.current=null;if(controls.current)clearOrbitDamping(controls.current);}
    draggingSticker.current=dragging?id:null;
    if(!dragging)queueMicrotask(()=>pointerEvents.update?.());
    if(controls.current)controls.current.enabled=!dragging&&!currentProps.current.paused&&modelPointer.current===null&&!pointerOrbit.current&&!touchActive.current;
  };
  const saveView = () => {
    if (!controls.current) return;
    const view = { position: camera.position.toArray() as [number, number, number], target: controls.current.target.toArray() as [number, number, number], zoom: camera.zoom };
    savedView.current = view;
    currentProps.current.onViewChange(view);
  };
  const queueView = () => { clearTimeout(viewTimer.current); viewTimer.current = setTimeout(saveView, 180); };
  const freezeAutoRotation = () => {
    const angle=rootAngle.current;
    if (!angle || !controls.current || !root.current) return;
    // 只在用户主动导航时转存当前朝向；载入另一份工程直接使用它保存的镜头。
    const pose=floatingPose(currentProps.current.data.floating,floatClock.current,currentProps.current.rotationPeriod,currentProps.current.data.floating?.enabled?floatingRadius(currentProps.current.data.surface):0);
    const axis=modelSpinAxis(currentProps.current.data.modelTilt).applyQuaternion(floatingRotation(pose));
    const pivot=rotationPivot();pivot.y+=pose.y;
    camera.position.sub(pivot).applyAxisAngle(axis,-angle).add(pivot); controls.current.target.sub(pivot).applyAxisAngle(axis,-angle).add(pivot);
    setRootAngle(0); rotationClock.current.elapsed=0;
    controls.current.update(); saveView(); invalidate();
  };
  useEffect(() => () => clearTimeout(viewTimer.current), []);
  useEffect(() => {
    // 本镜头产生的保存只用于持久化；回写会重复推进阻尼，破坏连续旋转。
    if (props.data.view === savedView.current) return;
    if (props.data.view && controls.current && !panGesture.current) { camera.zoom = props.data.view.zoom ?? 1; camera.updateProjectionMatrix(); camera.position.fromArray(props.data.view.position); controls.current.target.fromArray(props.data.view.target); controls.current.update(); invalidate(); }
  }, [props.data.view, camera, invalidate]);
  useEffect(()=>{
    const release=applyStudioLighting(scene,gl,resolveLighting(props.data.lighting,props.data.surface));environment.current=release;
    return ()=>{environment.current=null;release();};
  },[gl,scene]);
  useEffect(()=>{
    environment.current?.refresh();
    const lights=addStudioLights(scene,props.data.surface.kind==='mesh',props.data.surface.kind==='sign',resolveLighting(props.data.lighting,props.data.surface),props.data.surface.height);
    studioLights.current=lights;lights.update(camera);invalidate();
    return ()=>{studioLights.current=null;lights.dispose();};
  },[gl,scene,props.data.surface.id,props.data.surface.height,camera,invalidate]);
  useEffect(()=>{
    const settings=resolveLighting(props.data.lighting,props.data.surface);
    environment.current?.setSettings(settings);studioLights.current?.setSettings(settings);studioLights.current?.update(camera);gl.shadowMap.needsUpdate=true;invalidate();
  },[props.data.lighting,props.data.surface.id,props.data.surface.height,gl,camera,invalidate]);
  useEffect(()=>{environment.current?.refresh();invalidate();},[props.data.surface,invalidate]);
  useEffect(() => {
    const element = gl.domElement;
    let skipClick = false;
    let zoomTimer:ReturnType<typeof setTimeout>|undefined;
    // 三指拖拽由 macOS 转成左键拖动。Command 手势先于贴纸和 OrbitControls 截获，只用于平移。
    const command = (e: PointerEvent) => e.metaKey || (!/Mac|iPad|iPhone/.test(navigator.platform) && e.ctrlKey);
    const flushOrbitDamping = () => {
      const control = controls.current; if (!control) return;
      clearOrbitDamping(control);
    };
    const touch=new TouchNavigation({
      enabled:()=>!currentProps.current.paused&&!modelPanButton.current,
      onStart:point=>{
        touchActive.current=true;stopKeyboardOrbit();flushOrbitDamping();
        if(controls.current)controls.current.enabled=false;
        const rect=element.getBoundingClientRect(),ray=new THREE.Raycaster();
        camera.updateMatrixWorld();root.current?.updateMatrixWorld(true);
        ray.setFromCamera(new THREE.Vector2((point.x-rect.left)/rect.width*2-1,-(point.y-rect.top)/rect.height*2+1),camera);
        const stickerHit=currentProps.current.editable&&root.current?ray.intersectObjects(root.current.children,true).find(hit=>hit.object.visible&&hit.object.name.startsWith('sticker-')):undefined;
        if(stickerHit)currentProps.current.onTouchStickerSelect?.(stickerHit.object.name.slice('sticker-'.length));
        const sticker=Boolean(stickerHit);
        return {sticker};
      },
      onCancelSticker:()=>{element.dispatchEvent(new Event(CANCEL_TOUCH_STICKER));},
      onOrbit:(dx,dy)=>{
        const control=controls.current;if(!control)return;
        currentProps.current.onZoom?.(true);currentProps.current.onHover(null);currentProps.current.onNavigate();
        const radians=2*Math.PI/(Math.max(1,element.clientHeight)*camera.zoom);
        rotateViewAroundModel(camera,control.target,rotationPivot(),-dx*radians,-dy*radians);queueView();invalidate();
      },
      onTap:point=>{
        if(currentProps.current.paused||!root.current)return;
        const rect=element.getBoundingClientRect();if(point.x<rect.left||point.x>rect.right||point.y<rect.top||point.y>rect.bottom)return;
        const ray=new THREE.Raycaster();camera.updateMatrixWorld();root.current.updateMatrixWorld(true);
        ray.setFromCamera(new THREE.Vector2((point.x-rect.left)/rect.width*2-1,-(point.y-rect.top)/rect.height*2+1),camera);
        const local=ray.ray.clone().applyMatrix4(root.current.matrixWorld.clone().invert()),hit=modelHit(local,currentProps.current.data.surface);
        if(hit)currentProps.current.onPlace(hit);
      },
      onPinch:(ratio,point)=>{
        const control=controls.current;if(!control)return;
        currentProps.current.onZoom?.(true);currentProps.current.onHover(null);currentProps.current.onNavigate();
        const rect=element.getBoundingClientRect(),pointer=new THREE.Vector2((point.x-rect.left)/rect.width*2-1,-(point.y-rect.top)/rect.height*2+1),ray=new THREE.Raycaster();
        (ray as THREE.Raycaster&{firstHitOnly:boolean}).firstHitOnly=true;camera.updateMatrixWorld();root.current?.updateMatrixWorld(true);ray.setFromCamera(pointer,camera);
        const body=root.current?.getObjectByName(currentProps.current.data.surface.id),focus=body?ray.intersectObject(body,true)[0]?.point:undefined;
        zoomView(camera,control.target,camera.zoom*ratio,pointer,focus);control.rotateSpeed=1/camera.zoom;control.update();queueView();invalidate();
      },
      requestFrame:callback=>requestAnimationFrame(callback),cancelFrame:id=>cancelAnimationFrame(id),
      onEnd:()=>{
        touchActive.current=false;saveView();currentProps.current.onZoom?.(false);currentProps.current.onCommit();
        queueMicrotask(()=>{if(controls.current)controls.current.enabled=!currentProps.current.paused&&!draggingSticker.current&&modelPointer.current===null&&!pointerOrbit.current&&!touchActive.current;});
        pointerEvents.update?.();invalidate();
      },
    });
    const contextMenu=(event:Event)=>{if(touch.active){event.preventDefault();event.stopImmediatePropagation();}};
    const down = (e: PointerEvent) => {
      skipClick = false;
      if(e.pointerType==='touch'){
        if(touch.down(e.pointerId,{x:e.clientX,y:e.clientY})){e.preventDefault();e.stopImmediatePropagation();}
        if(touch.active)element.setPointerCapture(e.pointerId);
        return;
      }
      if(e.button===0&&!currentProps.current.paused)stopKeyboardOrbit();
      // Capture-phase ownership precedes OrbitControls' native pointer listener.
      // macOS three-finger drags arrive as ordinary left-button pointer events.
      if(e.button===0&&currentProps.current.editable&&root.current){
        const rect=element.getBoundingClientRect(),ray=new THREE.Raycaster();
        camera.updateMatrixWorld();root.current.updateMatrixWorld(true);
        ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
        if(ray.intersectObjects(root.current.children,true).some(hit=>hit.object.visible&&hit.object.name.startsWith('sticker-'))){
          modelPointer.current=e.pointerId;
          if(controls.current){flushOrbitDamping();controls.current.enabled=false;}
          element.setPointerCapture(e.pointerId);
          // The same event continues into Fiber so the sticker can own its gesture.
          return;
        }
      }
      if(e.button===0&&!command(e)&&!currentProps.current.paused&&controls.current&&!draggingSticker.current){
        pointerOrbit.current={pointer:e.pointerId,x:e.clientX,y:e.clientY,active:false,pivot:rotationPivot()};
        flushOrbitDamping();controls.current.enabled=false;element.setPointerCapture(e.pointerId);return;
      }
      if (e.button !== 0 || !command(e) || currentProps.current.paused || !controls.current) return;
      e.preventDefault(); e.stopImmediatePropagation(); skipClick = true;
      currentProps.current.onZoom?.(true);stopKeyboardOrbit(); flushOrbitDamping(); currentProps.current.onNavigate();
      panGesture.current = {pointer:e.pointerId,x:e.clientX,y:e.clientY};
      element.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const pan = panGesture.current, control = controls.current;
      if(e.pointerType==='touch'){
        if(touch.move(e.pointerId,{x:e.clientX,y:e.clientY})){e.preventDefault();e.stopImmediatePropagation();}
        return;
      }
      const orbit=pointerOrbit.current;
      if(!pan&&control&&orbit?.pointer===e.pointerId){
        const dx=e.clientX-orbit.x,dy=e.clientY-orbit.y;
        if(!orbit.active&&Math.hypot(dx,dy)>3){
          orbit.active=true;skipClick=true;currentProps.current.onZoom?.(true);
          currentProps.current.onHover(null);currentProps.current.onNavigate();
        }
        if(orbit.active){
          e.preventDefault();e.stopImmediatePropagation();
          const radians=2*Math.PI/(Math.max(1,element.clientHeight)*camera.zoom);
          rotateViewAroundModel(camera,control.target,orbit.pivot,-dx*radians,-dy*radians);
          orbit.x=e.clientX;orbit.y=e.clientY;queueView();invalidate();
        }
        return;
      }
      if (!pan || pan.pointer !== e.pointerId || !control) return;
      e.preventDefault(); e.stopImmediatePropagation();
      panView(camera, control.target, e.clientX-pan.x, e.clientY-pan.y, element.clientHeight);
      pan.x=e.clientX; pan.y=e.clientY; control.update(); invalidate();
    };
    const end = (e: PointerEvent) => {
      if(e.pointerType==='touch'){
        if(touch.end(e.pointerId,e.type==='pointerup',{x:e.clientX,y:e.clientY})){e.preventDefault();e.stopImmediatePropagation();}
        if(element.hasPointerCapture(e.pointerId))element.releasePointerCapture(e.pointerId);
        return;
      }
      const orbit=pointerOrbit.current;
      if(orbit?.pointer===e.pointerId){
        pointerOrbit.current=null;
        if(orbit.active){saveView();currentProps.current.onZoom?.(false);pointerEvents.update?.();invalidate();}
        if(element.hasPointerCapture(e.pointerId))element.releasePointerCapture(e.pointerId);
        queueMicrotask(()=>{if(controls.current)controls.current.enabled=!currentProps.current.paused&&!draggingSticker.current&&modelPointer.current===null&&!pointerOrbit.current&&!touchActive.current;});
      }
      if(modelPointer.current===e.pointerId){
        modelPointer.current=null;
        // Keep controls disabled through this event's remaining native listeners.
        queueMicrotask(()=>{if(controls.current)controls.current.enabled=!currentProps.current.paused&&!draggingSticker.current&&modelPointer.current===null&&!pointerOrbit.current&&!touchActive.current;});
      }
      if (panGesture.current?.pointer !== e.pointerId) return;
      e.preventDefault(); e.stopImmediatePropagation(); panGesture.current=null;
      if (element.hasPointerCapture(e.pointerId)) element.releasePointerCapture(e.pointerId);
      saveView();currentProps.current.onZoom?.(false);pointerEvents.update?.();invalidate();
    };
    const blur = () => {
      touch.cancel();
      const orbit=pointerOrbit.current;pointerOrbit.current=null;modelPointer.current=null;
      if(orbit&&element.hasPointerCapture(orbit.pointer))element.releasePointerCapture(orbit.pointer);
      if(controls.current)controls.current.enabled=!currentProps.current.paused&&!draggingSticker.current&&modelPointer.current===null&&!pointerOrbit.current&&!touchActive.current;
      const pan=panGesture.current; panGesture.current=null;
      if (pan && element.hasPointerCapture(pan.pointer)) element.releasePointerCapture(pan.pointer);
      saveView();currentProps.current.onZoom?.(false);
    };
    const click = (e: MouseEvent) => { if (skipClick||touch.suppressClick) { e.preventDefault(); e.stopImmediatePropagation(); skipClick=false; } };
    // 捏合使用 ctrl+wheel；普通滚轮不缩放。通过投影放大，并保持指针下的位置不漂移。
    const wheel = (e: WheelEvent) => {
      e.preventDefault(); e.stopImmediatePropagation();
      const control=controls.current;
      if ((!e.metaKey && !e.ctrlKey) || currentProps.current.paused || draggingSticker.current || modelPointer.current!==null || pointerOrbit.current || !control) return;
      currentProps.current.onZoom?.(true);clearTimeout(zoomTimer);
      zoomTimer=setTimeout(()=>{currentProps.current.onZoom?.(false);pointerEvents.update?.();invalidate();},180);
      stopKeyboardOrbit(); flushOrbitDamping(); currentProps.current.onNavigate();
      const rect=element.getBoundingClientRect();
      const pointer=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
      const unit=e.deltaMode===1 ? 16 : e.deltaMode===2 ? rect.height : 1;
      const delta=THREE.MathUtils.clamp(e.deltaY*unit,-100,100);
      // 在真实皮肤处确定缩放中心，放大到很近时仍保持指针下的细节位置。
      const ray=new THREE.Raycaster(); (ray as THREE.Raycaster & {firstHitOnly:boolean}).firstHitOnly=true;
      camera.updateMatrixWorld(); ray.setFromCamera(pointer,camera);
      const body=root.current?.getObjectByName(currentProps.current.data.surface.id);
      const focus=body ? ray.intersectObject(body,true)[0]?.point : undefined;
      zoomView(camera,control.target,camera.zoom*Math.exp(delta*(e.ctrlKey&&!e.metaKey?-1:1)*.004),pointer,focus);
      control.rotateSpeed=1/camera.zoom; control.update(); queueView(); invalidate();
    };
    element.addEventListener('contextmenu',contextMenu,{capture:true});
    element.addEventListener('pointerdown',down,{capture:true});
    element.addEventListener('pointermove',move,{capture:true});
    element.addEventListener('pointerup',end,{capture:true});
    element.addEventListener('pointercancel',end,{capture:true});
    element.addEventListener('lostpointercapture',end,{capture:true});
    element.addEventListener('click',click,{capture:true});
    element.addEventListener('wheel',wheel,{capture:true,passive:false});
    window.addEventListener('blur',blur);
    return () => {
      touch.cancel();
      panGesture.current=null;pointerOrbit.current=null;
      element.removeEventListener('contextmenu',contextMenu,true);
      element.removeEventListener('pointerdown',down,true); element.removeEventListener('pointermove',move,true);
      element.removeEventListener('pointerup',end,true); element.removeEventListener('pointercancel',end,true);
      element.removeEventListener('lostpointercapture',end,true); element.removeEventListener('click',click,true);
      clearTimeout(zoomTimer);currentProps.current.onZoom?.(false);element.removeEventListener('wheel',wheel,true); window.removeEventListener('blur',blur);
    };
  }, [gl,camera,invalidate]);
  useEffect(() => {
    rotationClock.current.last = performance.now();
    // Play/pause only freezes the clock. Never bake orientation into the camera.
    invalidate();
  }, [props.autoRotate, props.rotationPeriod, props.paused, invalidate]);
  useEffect(()=>{rotationClock.current.elapsed=0;floatClock.current=0;setRootAngle(0);invalidate();},[props.data.surface.id]);
  useEffect(() => {
    props.api.current = {
      dropDraft:(x,y)=>{
        if(currentProps.current.paused||!root.current)return false;
        const rect=gl.domElement.getBoundingClientRect();if(x<rect.left||x>rect.right||y<rect.top||y>rect.bottom)return false;
        const ray=new THREE.Raycaster();camera.updateMatrixWorld();root.current.updateMatrixWorld(true);
        ray.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1),camera);
        const hit=modelHit(ray.ray.clone().applyMatrix4(root.current.matrixWorld.clone().invert()),currentProps.current.data.surface);
        if(!hit)return false;currentProps.current.onPlace(hit);return true;
      },
      previewStickerEdit:sticker=>interactiveSticker.update(sticker,currentProps.current.data.surface),
      finishStickerEdit:sticker=>interactiveSticker.finish(sticker,currentProps.current.data.surface,geometryCache),
      cancelStickerEdit:()=>interactiveSticker.cancel(),
      previewCursorTransform:(data,scale)=>{
        const rect=gl.domElement.getBoundingClientRect(),point=new THREE.Vector3(...data.position),width=40/Math.max(1,rect.height)*2*camera.position.distanceTo(point)*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)/camera.zoom;
        point.add(new THREE.Vector3(.075*width,-.25*width,.005).applyEuler(new THREE.Euler(...data.rotation)));
        camera.updateMatrixWorld();root.current?.updateMatrixWorld();
        return stickerOverlayTransform({...data,position:point.toArray() as [number,number,number],scale:[width,width]},camera,root.current?.matrixWorld??new THREE.Matrix4(),rect,scale);
      },
      previewTransform:(data,scale)=>{camera.updateMatrixWorld();root.current?.updateMatrixWorld();return stickerOverlayTransform(data,camera,root.current?.matrixWorld??new THREE.Matrix4(),gl.domElement.getBoundingClientRect(),scale);},
      draftPixelScale:()=>{
        const body=root.current?.getObjectByName(currentProps.current.data.surface.id) as THREE.Mesh|undefined;
        const rect=gl.domElement.getBoundingClientRect();camera.updateMatrixWorld();root.current?.updateMatrixWorld(true);
        const cached=draftProjection.current,rootMatrix=root.current?.matrixWorld??new THREE.Matrix4();
        if(cached.geometry===body?.geometry&&cached.height===rect.height&&cached.camera.equals(camera.matrixWorldInverse)&&cached.projection.equals(camera.projectionMatrix)&&cached.root.equals(rootMatrix))return cached.pixels;
        // The rotation pivot stays at a stable camera depth during orbit.
        // A front-surface ray hit changes depth as the model turns and makes the paper pulse.
        const point=rotationPivot().applyMatrix4(rootMatrix);
        cached.camera.copy(camera.matrixWorldInverse);cached.projection.copy(camera.projectionMatrix);cached.root.copy(rootMatrix);cached.geometry=body?.geometry??null;cached.height=rect.height;cached.pixels=draftStickerPixelScale(camera,point,rect.height);
        return cached.pixels;
      },
      previewPixels:(x,y,extent)=>{
        const rect=gl.domElement.getBoundingClientRect(),pointer=new THREE.Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1),ray=new THREE.Raycaster();
        camera.updateMatrixWorld();ray.setFromCamera(pointer,camera);
        const hit=modelHit(ray.ray,currentProps.current.data.surface),point=hit?new THREE.Vector3(...hit.position):controls.current?.target.clone()??new THREE.Vector3();
        const depth=Math.max(.1,-point.applyMatrix4(camera.matrixWorldInverse).z);
        return extent*rect.height*camera.zoom/(2*depth*Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov/2)));
      },
      beginModelPan:()=>{gl.domElement.dispatchEvent(new Event(CANCEL_TOUCH_STICKER));modelPanButton.current=true;stopKeyboardOrbit();freezeAutoRotation();touchActive.current=true;if(controls.current){clearOrbitDamping(controls.current);controls.current.enabled=false;}currentProps.current.onZoom?.(true);},
      panModel:(dx,dy)=>{const control=controls.current;if(!control||currentProps.current.paused)return;panView(camera,control.target,dx,dy,gl.domElement.clientHeight);control.update();queueView();invalidate();},
      endModelPan:()=>{modelPanButton.current=false;touchActive.current=false;saveView();currentProps.current.onZoom?.(false);if(controls.current)controls.current.enabled=!currentProps.current.paused&&!draggingSticker.current&&modelPointer.current===null&&!pointerOrbit.current;invalidate();},
      freezeAutoRotation,
      revealSticker: sticker => {
        const control=controls.current;if(!control)return;
        const point=new THREE.Vector3(...sticker.position),normal=new THREE.Vector3(...sticker.normal).normalize();
        if(normal.dot(camera.position.clone().sub(point))>0)return;
        stopKeyboardOrbit();
        const pivot=rotationPivot(),offset=camera.position.clone().sub(pivot);
        reveal.current={elapsed:0,target:control.target.clone().sub(pivot),pivot,offset,rotation:new THREE.Quaternion().setFromUnitVectors(offset.clone().normalize(),normal)};
        invalidate();
      },
      defaultView:(surface=currentProps.current.data.surface)=>{const rect=gl.domElement.getBoundingClientRect();return framedModelView(surface,rect.width/Math.max(1,rect.height),camera.fov);},
      resetCamera: () => { stopKeyboardOrbit(); const rect=gl.domElement.getBoundingClientRect(),view=framedModelView(currentProps.current.data.surface,rect.width/Math.max(1,rect.height),camera.fov);camera.zoom=view.zoom!; camera.updateProjectionMatrix(); if (controls.current) controls.current.rotateSpeed=1/camera.zoom; camera.position.fromArray(view.position); controls.current?.target.fromArray(view.target); controls.current?.update(); setRootAngle(0); saveView(); invalidate(); },
      setOrbitKey: (key, pressed) => {
        const orbit = keyboardOrbit.current;
        if (pressed) {
          if(draggingSticker.current||modelPointer.current!==null||pointerOrbit.current||orbit.keys.has(key))return;
          reveal.current=null;
          // Keyboard rotation owns the camera until its release inertia settles.
          // Otherwise Drei's drag damping also changes it in the same frame.
          if(!orbit.active&&controls.current){clearOrbitDamping(controls.current);clearTimeout(viewTimer.current);controls.current.enabled=false;}
          if(!orbit.active)orbit.pivot.copy(rotationPivot());
          orbit.keys.add(key); orbit.active = true;
          // 立即设置初始速度，让下一帧之前就松开的轻按也能产生惯性。
          orbit.velocity = stepKeyboardOrbit(orbit.keys, orbit.velocity, 0).velocity;
          props.onHover(null);
        } else orbit.keys.delete(key);
        invalidate();
      },
      stopKeyboardOrbit,
      renderAtTime: time => { overrideTime.current = time; invalidate(); },
      rotateModel: angle => { setRootAngle(angle); invalidate(); },
      getDiagnostics: () => {
        let meshes = 0, stickers = 0, triangles = 0;
        root.current?.traverse(o => {
          if (o instanceof THREE.Mesh) { meshes++; if (o.name.startsWith('sticker-')) stickers++; triangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3; }
        });
        return { meshes, stickers, triangles, assetTextures: assetTextures.stats.loaded, frames: frames.current };
      },
    };
    return () => { props.api.current = null; };
  }, [props.api]);
  useEffect(()=>{floatClock.current=0;invalidate();},[props.data.surface.id,props.data.floating?.enabled,invalidate]);
  // 在拖拽控制器（-1）之后、贴纸（0）之前更新镜头、光照和统一时间。
  useFrame((_, delta) => {
    frames.current++; timeline.current.current = overrideTime.current ?? props.now(); timeline.current.manual = overrideTime.current !== null || props.motionTime!=null;
    if(props.motionTime!=null){timeline.current.current=props.motionTime;setRootAngle(animation.at(props.motionTime).angle);}
    else if(!props.autoRotate)setRootAngle(rootAngle.current);
    const orbit = keyboardOrbit.current, control = controls.current;
    if (orbit.active && control && !props.paused && !props.autoRotate) {
      const next = stepKeyboardOrbit(orbit.keys, orbit.velocity, Math.min(delta, .05));
      orbit.velocity = next.velocity;
      rotateViewAroundModel(camera,control.target,orbit.pivot,next.delta.x/camera.zoom,next.delta.y/camera.zoom);
      if (orbit.keys.size || Math.hypot(next.velocity.x, next.velocity.y) > .001) invalidate();
      else { orbit.active = false; orbit.velocity = {x:0,y:0}; control.enabled=!props.paused&&!draggingSticker.current&&modelPointer.current===null&&!pointerOrbit.current&&!touchActive.current; saveView(); }
    }
    if (props.autoRotate && !props.paused && root.current) {
      const tick = performance.now(),elapsed=(tick-rotationClock.current.last)/1000;if(props.data.motion?.enabled!==false)rotationClock.current.elapsed+=elapsed;floatClock.current+=elapsed;rotationClock.current.last=tick;
      setRootAngle(props.data.motion?.enabled===false?rootAngle.current:turntableAngle(rotationClock.current.elapsed, props.rotationPeriod)*((props.data.motion?.direction??'right')==='right'?-1:1)); invalidate();
    }
    const focus=reveal.current;
    if(focus&&control){
      focus.elapsed+=Math.min(delta,.05);const progress=Math.min(1,focus.elapsed/.35),ease=progress*progress*(3-2*progress);
      const rotation=new THREE.Quaternion().slerp(focus.rotation,ease);
      camera.position.copy(focus.offset).applyQuaternion(rotation).add(focus.pivot);
      control.target.copy(focus.target).applyQuaternion(rotation).add(focus.pivot);control.update();invalidate();
      if(progress===1){reveal.current=null;saveView();}
    }
    studioLights.current?.update(camera);
    const shadow=shadowView.current,angle=rootAngle.current;
    const moving=Boolean(props.autoRotate&&props.data.floating?.enabled)||!shadow.position.equals(camera.position)||!shadow.rotation.equals(camera.quaternion)||shadow.angle!==angle;
    if(moving){
      gl.shadowMap.needsUpdate=true;
      shadow.position.copy(camera.position);shadow.rotation.copy(camera.quaternion);shadow.angle=angle;
    }
    const tick=performance.now();if(moving&&!props.paused)lastPreviewMotion.current=tick;
    const fullDpr=viewport.initialDpr||Math.min(window.devicePixelRatio,2),activeMotion=props.data.surface.kind==='custom'&&!props.paused&&tick-lastPreviewMotion.current<250;
    const dpr=activeMotion?movingPreviewDpr(size.width,size.height,fullDpr):fullDpr;
    if(Math.abs(gl.getPixelRatio()-dpr)>.01)setDpr(dpr);
    if(activeMotion&&!moving)invalidate();
  }, -.5);
  return <>
    <group ref={root}>
      <StickerSurface modelColor={props.data.modelColor} cache={geometryCache} draggingId={draggingSticker} surface={props.data.surface} onHover={props.onHover} onPlace={hit => { if (props.editable) props.onSelect(null); else props.onPlace(hit); }} />
      {props.data.stickers.map(data => {
        const asset = props.data.assets.find(a => a.id === data.assetId);
        return asset ? <Sticker animationPlacedAt={props.motionTime!=null?animation.starts.get(data.id):undefined} cache={geometryCache} key={data.id} data={data} asset={asset} surface={props.data.surface} timeline={timeline.current} editable={props.editable} onSelect={props.onSelect} onMove={props.onMove} draggingId={draggingSticker} onDragState={dragging=>dragState(dragging,data.id)} onCommit={props.onCommit} onRemove={props.onRemove} /> : null;
      })}
    </group>
    <OrbitControls ref={controls} makeDefault enabled={!props.paused&&!draggingSticker.current&&modelPointer.current===null&&!pointerOrbit.current&&!touchActive.current} enablePan={false} enableZoom={false} minDistance={3.3} maxDistance={14} rotateSpeed={1 / (props.data.view?.zoom ?? 1)}
      minPolarAngle={0} maxPolarAngle={Math.PI}
      onStart={() => { props.onZoom?.(true);stopKeyboardOrbit(); props.onHover(null); props.onNavigate(); }} onChange={()=>{if(!keyboardOrbit.current.active)queueView();}} onEnd={() => {saveView();props.onZoom?.(false);pointerEvents.update?.();invalidate();}} />
  </>;
}

export function Scene(props: Props) {
  const [contextLost, setContextLost] = useState(false);
  const initialCamera=useRef({position:[...(props.data.view?.position??[0,.18,8.8])] as [number,number,number],zoom:props.data.view?.zoom??1,fov:39,near:.1,far:100});
  return <>
    <Canvas events={state=>({...events(state),filter:sortStickerIntersections,compute:(event,state)=>{const rect=state.gl.domElement.getBoundingClientRect();state.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);state.raycaster.setFromCamera(state.pointer,state.camera);}})} shadows frameloop="demand" camera={initialCamera.current} dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      onCreated={({ gl }) => gl.domElement.addEventListener('webglcontextlost', () => setContextLost(true))}>
      <World {...props} />
    </Canvas>
    {contextLost && <div className="webgl-error">3D 上下文已中断，请刷新页面恢复。</div>}
  </>;
}
