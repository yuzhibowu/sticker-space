import {StickerRemoval} from './stickerRemoval';
import {CANCEL_TOUCH_STICKER} from '../core/touchNavigation';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import type { StickerAsset, StickerData, SurfaceData, Placement } from '../core/types';
import { useAssetTexture, opaqueAt } from './assetTextures';
import { paperLandingReady } from '../core/paperLanding';
import { signPoleSurface } from '../core/signAttachment';
import { modelHit } from '../core/modelSurface';
import { stickerRoll } from '../core/editing';
import type { PreviewGeometryCache } from './PreviewGeometryCache';
import { stickerPoseAtTime } from '../core/timeline';
import { stickerMaterial, peelPaperMaterials, setPeelPaperLayer } from './materials';
import { PeelSheet, screenPeelDirection, peelExtent, peelProgressForTravel, peelDropAction, stepPeelSpring, PEEL_DETACH_THRESHOLD } from '../core/stickerPeel';
import type { PeelDirection } from '../core/stickerPeel';
import { peelSound } from './peelSound';
import { planCatPawSweep,advanceCatPawElapsed,type CatPawSweep } from '../core/catPaw';
import { CatPawOverlay } from './catPawOverlay';
import { CarriedPaperOverlay } from './carriedPaperOverlay';
import { stickerHitIsVisible } from '../core/stickerVisibility';

type PeelGesture = {
  pointer: number | null; x: number; y: number; direction: PeelDirection; projectedExtent: number; screenU:THREE.Vector2; screenV:THREE.Vector2;
  sheet: PeelSheet; progress: number; velocity: number; detached: boolean; elapsed: number;
  carryPosition: THREE.Vector3; carryRotation: THREE.Quaternion; carryPlane: THREE.Plane;
  screen:{x:number;y:number};overlay:CarriedPaperOverlay|null;landing: Placement | null; discard:{plan:CatPawSweep;overlay:CatPawOverlay;elapsed:number}|null;
  placing?:{source:StickerData;geometry:THREE.BufferGeometry};
};

export function Sticker({ animationPlacedAt, data, asset, surface, timeline, editable, onSelect, onMove, onDragState, onCommit, onRemove, draggingId, cache }: {
  animationPlacedAt?:number; data: StickerData; asset: StickerAsset; surface: SurfaceData; timeline: { current: number; manual: boolean };
  editable: boolean; onSelect: (id: string) => void; onMove: (id: string, hit: Placement) => void;
  cache:PreviewGeometryCache; draggingId: MutableRefObject<string|null>; onDragState: (dragging: boolean) => void; onCommit: () => void; onRemove: (id: string) => void;
}) {
  const { invalidate, gl, camera } = useThree();
  const map=useAssetTexture(asset),support=signPoleSurface(surface,data)??surface;
  const attached=useRef<THREE.Mesh>(null),flyer=useRef<THREE.Group>(null),loose=useRef<THREE.Group>(null);
  const front=useRef<THREE.Mesh>(null),back=useRef<THREE.Mesh>(null);
  const geometry=useMemo(()=>cache.sticker(data,surface),[data,surface]);
  const material=useMemo(()=>map?stickerMaterial(map):null,[map]);
  const paper=useMemo(()=>map?peelPaperMaterials(map):null,[map]);
  const plane=useMemo(()=>new THREE.PlaneGeometry(...data.scale),[data.scale]);
  const pending=useRef<{pointer:number;x:number;y:number}|null>(null),peel=useRef<PeelGesture|null>(null),peeledClick=useRef(false);
  const settled=useRef(false),manual=useRef(false),removal=useRef(new StickerRemoval());
  const reset = () => {
    peelSound.cancel(data.id);
    peel.current?.overlay?.destroy();peel.current?.discard?.overlay.destroy();peel.current?.sheet.dispose();peel.current=null;pending.current=null;
    if(loose.current)loose.current.visible=false;
    delete gl.domElement.dataset.peelEdge;settled.current=false;invalidate();
  };
  const cancel = () => {
    peelSound.cancel(data.id);
    if(!pending.current&&peel.current?.pointer==null&&!peel.current?.discard&&!peel.current?.placing)return;
    pending.current=null;
    const state=peel.current;
    if(state?.discard||state?.placing){reset();onDragState(false);return;}
    if(state){state.pointer=null;state.detached=false;state.velocity=0;}
    onDragState(false);delete gl.domElement.dataset.peelEdge;invalidate();
  };
  useEffect(()=>{
    const cancelTouch=()=>{if(pending.current||peel.current?.pointer!=null)cancel();};
    gl.domElement.addEventListener(CANCEL_TOUCH_STICKER,cancelTouch);
    const lost=(e:PointerEvent)=>{if(pending.current?.pointer===e.pointerId||peel.current?.pointer===e.pointerId)cancel();};
    const undo=(e:KeyboardEvent)=>{
      if(peel.current?.placing&&(e.metaKey||e.ctrlKey)&&!e.shiftKey&&e.key.toLowerCase()==='z')cancel();
      if(peel.current?.discard&&(e.metaKey||e.ctrlKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'&&!(e.target as HTMLElement).closest?.('input,textarea,[contenteditable="true"]')){
        e.preventDefault();e.stopImmediatePropagation();cancel();
      }
    };
    gl.domElement.addEventListener('lostpointercapture',lost);window.addEventListener('blur',cancel);window.addEventListener('keydown',undo,true);
    return()=>{gl.domElement.removeEventListener(CANCEL_TOUCH_STICKER,cancelTouch);peelSound.cancel(data.id);gl.domElement.removeEventListener('lostpointercapture',lost);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',undo,true);if(pending.current||peel.current?.pointer!=null||peel.current?.discard||peel.current?.placing)onDragState(false);peel.current?.overlay?.destroy();peel.current?.discard?.overlay.destroy();peel.current?.sheet.dispose();peel.current=null;delete gl.domElement.dataset.peelEdge;};
  },[gl]);
  useEffect(()=>()=>plane.dispose(),[plane]);
  useEffect(()=>()=>material?.dispose(),[material]);
  useEffect(()=>()=>{paper?.front.dispose();paper?.back.dispose();},[paper]);
  useEffect(()=>{settled.current=false;invalidate();},[data,map,invalidate]);
  useEffect(()=>{if(editable)peelSound.prepare();else{cancel();reset();}},[editable]);

  useFrame((_,delta)=>{
    // DOM removal and the separate Canvas commit can span several frames.
    // Keep a completed discard invisible until this Sticker actually unmounts.
    if(removal.current.hide([attached.current,flyer.current,loose.current]))return;
    const state=peel.current;
    if(state?.placing&&attached.current){
      if(paperLandingReady(state.placing,data,geometry,attached.current.geometry)){
        reset();attached.current.visible=true;if(flyer.current)flyer.current.visible=false;
        settled.current=true;onDragState(false);return;
      }
      state.elapsed=.16;
    }
    if(state&&paper&&loose.current&&front.current&&back.current){
      setPeelPaperLayer(paper,front.current,back.current,state.detached,data.order);
      if(state.discard){
        if(state.discard.overlay.failed){reset();onDragState(false);return;}
        state.discard.elapsed=advanceCatPawElapsed(state.discard.elapsed,delta,state.discard.overlay.ready);
        const pose=state.discard.overlay.update(state.discard.elapsed),rect=gl.domElement.getBoundingClientRect();
        state.screen=pose.paper;
        const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((pose.paper.x-rect.left)/rect.width*2-1,-(pose.paper.y-rect.top)/rect.height*2+1),camera);
        ray.ray.applyMatrix4(attached.current!.parent!.matrixWorld.clone().invert()).intersectPlane(state.carryPlane,state.carryPosition);
        state.sheet.carry(state.carryPosition,state.carryRotation,1);
        if(pose.complete){removal.current.finish([attached.current,flyer.current,loose.current],reset,()=>onRemove(data.id));onDragState(false);return;}
      }else if(state.detached){
        state.elapsed+=Math.min(delta,.05);
        state.sheet.carry(state.carryPosition,state.carryRotation,state.elapsed/.16);
      }else{
        if(state.pointer===null){
          const next=stepPeelSpring(state.progress,state.velocity,0,Math.min(delta,.05));
          state.progress=next.value;state.velocity=next.velocity;
          if(state.progress<.0005&&Math.abs(state.velocity)<.01){reset();return;}
        }
        state.sheet.update(state.progress,state.direction,new THREE.Vector3(...data.normal));
      }
      front.current.geometry=state.sheet.geometry;back.current.geometry=state.sheet.geometry;
      const overlayVisible=state.detached&&state.elapsed>=.16;
      if(state.overlay){
        const perspective=camera as THREE.PerspectiveCamera;
        const depth=Math.max(.1,-state.carryPosition.clone().applyMatrix4(attached.current!.parent!.matrixWorld).applyMatrix4(camera.matrixWorldInverse).z);
        const pixels=gl.domElement.clientHeight*perspective.zoom/(2*depth*Math.tan(THREE.MathUtils.degToRad(perspective.fov/2)));
        state.overlay.update(state.screen.x,state.screen.y,data.scale[0]*pixels,data.scale[1]*pixels,stickerRoll(data),overlayVisible);
      }
      loose.current.visible=!overlayVisible;
      if(attached.current)attached.current.visible=false;if(flyer.current)flyer.current.visible=false;
      if(state.placing||state.discard?.overlay.ready||!state.detached||state.elapsed<.16)invalidate();return;
    }
    if(settled.current&&!timeline.manual&&!manual.current)return;
    manual.current=timeline.manual;
    const pose=stickerPoseAtTime(timeline.current,animationPlacedAt??data.placedAt);
    if(attached.current)attached.current.visible=pose.visible&&pose.complete;
    if(flyer.current){
      flyer.current.visible=pose.visible&&!pose.complete;
      flyer.current.position.set(data.position[0]+data.normal[0]*(pose.distance+.008),data.position[1]+data.normal[1]*(pose.distance+.008),data.position[2]+data.normal[2]*(pose.distance+.008));
      flyer.current.rotation.set(...data.rotation);flyer.current.rotateX(pose.tilt);flyer.current.scale.setScalar(pose.scale);
    }
    settled.current=pose.complete;if(!timeline.manual&&!pose.complete)invalidate();
  });

  const localRay=(e:ThreeEvent<PointerEvent>)=>e.ray.clone().applyMatrix4(attached.current!.parent!.matrixWorld.clone().invert());
  const projectedAxis=(axis:'u'|'v')=>{
    const parent=attached.current!.parent!,rect=gl.domElement.getBoundingClientRect();
    const center=new THREE.Vector3(...data.position),end=new THREE.Vector3(axis==='u'?data.scale[0]:0,axis==='v'?data.scale[1]:0,0).applyEuler(new THREE.Euler(...data.rotation)).add(center);
    center.applyMatrix4(parent.matrixWorld).project(camera);end.applyMatrix4(parent.matrixWorld).project(camera);
    return new THREE.Vector2((end.x-center.x)*rect.width/2,-(end.y-center.y)*rect.height/2);
  };
  const follow=(state:PeelGesture,e:ThreeEvent<PointerEvent>)=>{
    const ray=localRay(e),rect=gl.domElement.getBoundingClientRect();
    state.screen={x:e.clientX,y:e.clientY};
    const inside=e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.bottom;
    state.landing=inside?modelHit(ray,surface):null;
    ray.intersectPlane(state.carryPlane,state.carryPosition);
  };
  const finish=(e:ThreeEvent<PointerEvent>)=>{
    if(pending.current?.pointer!==e.pointerId&&peel.current?.pointer!==e.pointerId)return;
    e.stopPropagation();pending.current=null;
    const state=peel.current;
    if(e.type==='pointercancel')peelSound.cancel(data.id);else peelSound.end(data.id,state?.progress??0);
    let finishingLater=false;
    if(state){
      if(state.detached)follow(state,e);
      const action=peelDropAction(state.detached,Boolean(state.landing),e.type==='pointercancel');
      state.pointer=null;
      if(action==='place'){
        const landing=state.landing!;
        state.placing={source:data,geometry:attached.current!.geometry};
        state.elapsed=.16;
        // Canvas has its own renderer: its frame callback acknowledges the mesh.
        onMove(data.id,landing);onCommit();finishingLater=true;invalidate();
      }
      else if(action==='remove'){
        const rect=gl.domElement.getBoundingClientRect(),perspective=camera as THREE.PerspectiveCamera;
        const depth=Math.max(.1,-state.carryPosition.clone().applyMatrix4(attached.current!.parent!.matrixWorld).applyMatrix4(camera.matrixWorldInverse).z);
        const extent=Math.hypot(...data.scale)*rect.height*perspective.zoom/(2*depth*Math.tan(THREE.MathUtils.degToRad(perspective.fov/2)));
        const plan=planCatPawSweep({x:e.clientX,y:e.clientY},rect,extent);
        state.overlay?.clipTo(rect);
        state.elapsed=.16;state.sheet.carry(state.carryPosition,state.carryRotation,1);
        state.discard={plan,overlay:new CatPawOverlay(plan,invalidate),elapsed:0};finishingLater=true;invalidate();
      }
      else{state.detached=false;state.velocity=0;invalidate();}
    }
    if(!finishingLater)onDragState(false);
    if(!state&&e.type==='pointerup')gl.domElement.dataset.peelEdge='true';else delete gl.domElement.dataset.peelEdge;
    if((e.target as Element).hasPointerCapture(e.pointerId))(e.target as Element).releasePointerCapture(e.pointerId);
  };
  if(!material||!paper)return null;
  return <>
    <mesh ref={attached} visible={false} name={`sticker-${data.id}`} dispose={null} geometry={geometry} material={material} renderOrder={data.order+1}
      raycast={editable?function(this:THREE.Mesh,ray,hits){
        if(!this.visible||draggingId.current||peel.current)return;
        if(!ray.ray.intersectsSphere(this.geometry.boundingSphere!.clone().applyMatrix4(this.matrixWorld)))return;
        const pick=this.geometry as THREE.BufferGeometry&{boundsTree?:MeshBVH};if(!pick.boundsTree)pick.boundsTree=new MeshBVH(pick);
        const found:THREE.Intersection[]=[];acceleratedRaycast.call(this,ray,found);
        const inverse=this.parent!.matrixWorld.clone().invert(),local=ray.ray.clone().applyMatrix4(inverse),body=modelHit(local,surface);
        hits.push(...found.filter(hit=>opaqueAt(map!,hit.uv)&&stickerHitIsVisible(local,hit.point.clone().applyMatrix4(inverse),body)));
      }:()=>{}}
      onPointerOver={e=>{if(editable&&!draggingId.current){e.stopPropagation();gl.domElement.dataset.peelEdge='true';}}}
      onClick={e=>{if(editable){e.stopPropagation();if(!peeledClick.current&&e.delta<5)onSelect(data.id);}}}
      onPointerDown={e=>{
        if(!editable||e.button!==0||peel.current||draggingId.current)return;
        e.stopPropagation();gl.domElement.dataset.peelEdge='true';peelSound.begin(data.id);peeledClick.current=false;pending.current={pointer:e.pointerId,x:e.clientX,y:e.clientY};
        onDragState(true);(e.target as Element).setPointerCapture(e.pointerId);
      }}
      onPointerMove={e=>{
        const start=pending.current;
        if(start?.pointer===e.pointerId){
          e.stopPropagation();const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.hypot(dx,dy)<4)return;
          const u=projectedAxis('u').divideScalar(data.scale[0]),v=projectedAxis('v').divideScalar(data.scale[1]),direction=screenPeelDirection(dx,dy,u,v);
          const projectedExtent=u.clone().multiplyScalar(direction.x).addScaledVector(v,direction.y).length()*peelExtent(data.scale,direction);
          const parent=attached.current!.parent!,inverse=parent.matrixWorld.clone().invert();
          const normal=camera.getWorldDirection(new THREE.Vector3()).transformDirection(inverse);
          peel.current={pointer:e.pointerId,x:start.x,y:start.y,direction,projectedExtent,screenU:u,screenV:v,sheet:new PeelSheet(geometry,data.scale,new THREE.Quaternion().setFromEuler(new THREE.Euler(...data.rotation)),support.kind==='cylinder'?support.radius:undefined),progress:0,velocity:0,detached:false,elapsed:0,carryPosition:new THREE.Vector3(...data.position),carryRotation:parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(camera.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),stickerRoll(data))),carryPlane:new THREE.Plane().setFromNormalAndCoplanarPoint(normal,new THREE.Vector3(...data.position)),screen:{x:e.clientX,y:e.clientY},overlay:null,landing:null,discard:null};
          pending.current=null;peeledClick.current=true;gl.domElement.dataset.peelEdge='true';
        }
        const state=peel.current;
        if(state?.pointer===e.pointerId){
          e.stopPropagation();
          if(state.detached)follow(state,e);
          else{
            const dx=e.clientX-state.x,dy=e.clientY-state.y;
            if(Math.hypot(dx,dy)>4){
              state.direction=screenPeelDirection(dx,dy,state.screenU,state.screenV);
              state.projectedExtent=state.screenU.clone().multiplyScalar(state.direction.x).addScaledVector(state.screenV,state.direction.y).length()*peelExtent(data.scale,state.direction);
            }
            state.progress=peelProgressForTravel(Math.hypot(dx,dy),state.projectedExtent);
            peelSound.move(data.id,state.progress,performance.now());
            if(state.progress>=PEEL_DETACH_THRESHOLD){state.sheet.update(1,state.direction,new THREE.Vector3(...data.normal));state.detached=true;state.overlay=new CarriedPaperOverlay(asset.image);peelSound.end(data.id,1);follow(state,e);}
          }
          invalidate();return;
        }
        if(editable&&!draggingId.current){e.stopPropagation();gl.domElement.dataset.peelEdge='true';}
      }}
      onPointerOut={()=>{if(!pending.current&&peel.current?.pointer==null)delete gl.domElement.dataset.peelEdge;}}
      onPointerUp={finish} onPointerCancel={finish}/>
    <group ref={loose} visible={false} dispose={null}>
      <mesh ref={front} geometry={plane} material={paper.front} renderOrder={data.order+2} frustumCulled={false} raycast={()=>{}}/>
      <mesh ref={back} geometry={plane} material={paper.back} renderOrder={data.order+2} frustumCulled={false} raycast={()=>{}}/>
    </group>
    <group ref={flyer}><mesh geometry={plane} material={material} renderOrder={data.order+1} raycast={()=>{}}/></group>
  </>;
}
