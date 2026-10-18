import {modelPreviewScene} from '../core/modelPreview';
import {resolveLighting} from '../core/modelLighting';
import {useEffect,useId,useMemo,useRef,useState,type CSSProperties,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import * as THREE from 'three';
import {POLE,DAVID,ROAD_SIGN,type StickerSceneData,type SurfaceData} from '../core/types';
import {buildSceneSnapshot,disposeSnapshot} from '../export/pipeline';
import {applyStudioLighting,addStudioLights} from '../scene/lighting';
import {MODEL_EXAMPLES,isModelExample,loadModelExample} from '../core/modelExamples';

type Option={value:string;name:string;custom:boolean;scene:StickerSceneData};
const modelValue=(surface:SurfaceData)=>surface.kind==='custom'?surface.id:surface.kind==='mesh'?'david':surface.kind==='sign'?'sign':'pole';
/** Passing across menu rows must not launch a model download or a GPU context. */
function IntentModelPreview({data}:{data:StickerSceneData}){
 const [ready,setReady]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>setReady(true),300);return()=>clearTimeout(timer);},[]);
 return ready?<AnimatedModelPreview data={data}/>:<div className="model-picker-preview-stage"><span>模型预览</span></div>;
}
function AnimatedModelPreview({data}:{data:StickerSceneData}){
 const host=useRef<HTMLDivElement>(null),[status,setStatus]=useState('加载预览…');
 useEffect(()=>{
  let active=true,frame=0,root:THREE.Group|undefined,renderer:THREE.WebGLRenderer|undefined,release:(()=>void)|undefined,lights:ReturnType<typeof addStudioLights>|undefined;
  const clear=()=>{cancelAnimationFrame(frame);release?.();release=undefined;lights?.dispose();lights=undefined;if(root){disposeSnapshot(root);root=undefined;}if(renderer){renderer.domElement.remove();renderer.dispose();renderer.forceContextLoss();renderer=undefined;}};
  setStatus('加载预览…');
  void(async()=>{
   try{
    const example=MODEL_EXAMPLES.find(s=>s.id===data.surface.id),surface=example?await loadModelExample(example):data.surface;
    if(!active)return;
    const model=await buildSceneSnapshot({...data,surface});
    if(!active){disposeSnapshot(model);return;}
    root=model;const scene=new THREE.Scene(),pivot=new THREE.Group();
    const bounds=new THREE.Box3().setFromObject(root),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
    root.position.sub(center);pivot.add(root);scene.add(pivot);
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setSize(176,99,false);renderer.setClearColor(0,0);
    const camera=new THREE.PerspectiveCamera(35,16/9,.01,200),radius=Math.hypot(size.x,size.z)/2;
    const distance=Math.max(size.y/2,radius/(16/9))/Math.tan(35*Math.PI/360)*1.2+radius;
    camera.position.set(0,size.y*.04,Math.max(distance,.1));camera.lookAt(0,0,0);
    const lighting=resolveLighting(data.lighting,surface);release=applyStudioLighting(scene,renderer,lighting);lights=addStudioLights(scene,surface.kind==='mesh',surface.kind==='sign',lighting,surface.height);lights.update(camera);
    renderer.render(scene,camera);
    if(!active){clear();return;}
    host.current?.append(renderer.domElement);setStatus('');const started=performance.now();
    const animate=(now:number)=>{if(!active||!renderer)return;pivot.rotation.y=-(now-started)/8000*Math.PI*2;renderer.render(scene,camera);frame=requestAnimationFrame(animate);};
    frame=requestAnimationFrame(animate);
   }catch{clear();if(active)setStatus('预览暂不可用');}
  })();
  return()=>{active=false;cancelAnimationFrame(frame);clear();};
 },[data.surface,data.lighting,data.modelColor,data.modelTilt]);
 return <div className="model-picker-preview-stage"><div className="model-picker-preview-canvas" ref={host}/>{status&&<span>{status}</span>}</div>;
}

export function ModelPicker({scene,disabled,onChange}:{scene:StickerSceneData;disabled:boolean;onChange:(value:string)=>void}){
 const [open,setOpen]=useState(false),[focused,setFocused]=useState(0),[preview,setPreview]=useState<{option:Option;left:number;top:number}|null>(null);
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),id=useId();
 const options=useMemo(()=>{
  const works=[scene,...(scene.otherModels??[])];
  const build=(surface:SurfaceData,name:string):Option=>{return {value:modelValue(surface),name,custom:surface.kind==='custom',scene:modelPreviewScene(scene,surface)};};
  const examples=MODEL_EXAMPLES.map(surface=>{
   return {value:surface.id,name:surface.name,custom:false,scene:modelPreviewScene(scene,surface)};
  });
  const first=examples.filter(option=>option.value==='custom-example-sticky-note');
  return [...first,build(POLE,'金属电线杆'),build(DAVID,'大卫雕塑'),build(ROAD_SIGN,'菱形路牌'),...examples.filter(option=>option.value!=='custom-example-sticky-note'),...works.filter(w=>w.surface.kind==='custom'&&!isModelExample(w.surface.id)).map(w=>build(w.surface,w.surface.kind==='custom'?w.surface.name:''))];
 },[scene]);
 const value=modelValue(scene.surface),selected=Math.max(0,options.findIndex(o=>o.value===value));
 const close=()=>{setOpen(false);setPreview(null);};
 useEffect(()=>{if(disabled)close();},[disabled]);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))close();};
  const blur=()=>close();document.addEventListener('pointerdown',outside);window.addEventListener('blur',blur);
  return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('blur',blur);};
 },[open]);
 const show=(index:number,y:number,x?:number)=>{
  const rect=menu.current?.getBoundingClientRect();if(!rect)return;
  const width=188,height=132,gap=16;
  const left=(x??rect.right)+gap;
  setPreview({option:options[index],left:Math.max(12,left),top:Math.max(12,Math.min(y-56,window.innerHeight-height-12))});
 };
 const choose=(index:number)=>{if(disabled)return;close();trigger.current?.focus({preventScroll:true});onChange(options[index].value);};
 const keyboard=(event:KeyboardEvent)=>{
  if(disabled)return;
  if(event.key==='Tab'){close();return;}
  if(!['ArrowDown','ArrowUp','Home','End','Enter',' ','Escape'].includes(event.key))return;
  event.preventDefault();event.stopPropagation();
  if(event.key==='Escape'){close();trigger.current?.focus({preventScroll:true});return;}
  if(event.key==='Enter'||event.key===' '){if(open)choose(focused);else{setFocused(selected);setOpen(true);}return;}
  if(!open){setFocused(selected);setOpen(true);return;}
  const next=event.key==='Home'?0:event.key==='End'?options.length-1:(focused+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;
  setFocused(next);const row=menu.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[next];if(row)show(next,row.getBoundingClientRect().top+15);
 };
 const compactMenu=window.innerHeight<520,rowHeight=compactMenu?19:29;
 const availableRows=Math.max(1,Math.floor((window.innerHeight-60)/rowHeight));
 const columns=Math.ceil(options.length/availableRows),rows=Math.ceil(options.length/columns);
 const menuStyle={'--model-picker-columns':columns,'--model-picker-rows':rows} as CSSProperties;
 return <div className="model-picker" ref={root}>
  <button type="button" className="model-picker-trigger" ref={trigger} aria-label="选择模型" aria-haspopup="listbox" aria-expanded={open} aria-controls={open?id:undefined} aria-activedescendant={open?`${id}-${focused}`:undefined} aria-disabled={disabled} onClick={()=>{if(disabled)return;setFocused(selected);setPreview(null);setOpen(v=>!v);}} onKeyDown={keyboard}>
   <span className="model-picker-label">{options[selected].name}</span><span aria-hidden="true" className={`model-picker-arrow ${open?'open':''}`}/>
  </button>
  {open&&<div className="model-picker-menu" role="listbox" aria-label="模型" id={id} ref={menu} style={menuStyle} onKeyDown={keyboard} onPointerLeave={()=>setPreview(null)}>
   {options.map((option,index)=><div key={option.value} className={index>0&&option.custom!==options[index-1].custom?'model-picker-option-group-start':undefined}>
    <button type="button" role="option" id={`${id}-${index}`} aria-selected={value===option.value} tabIndex={-1} className={`model-picker-option ${value===option.value?'selected':''} ${focused===index?'focused':''}`} onPointerEnter={event=>{if(event.pointerType==='touch')return;setFocused(index);show(index,event.clientY,event.clientX);}} onPointerMove={event=>{if(event.pointerType!=='touch')show(index,event.clientY,event.clientX);}} onFocus={event=>{setFocused(index);show(index,event.currentTarget.getBoundingClientRect().top+15);}} onClick={()=>choose(index)}>{option.name}</button>
   </div>)}
  </div>}
  {open&&preview&&createPortal(<div className="model-picker-preview" style={{left:preview.left,top:preview.top,maxWidth:Math.max(40,window.innerWidth-preview.left-8)}} role="tooltip" aria-label={`${preview.option.name}动画预览`}><IntentModelPreview key={preview.option.value} data={preview.option.scene}/><span className="model-picker-preview-name">{preview.option.name}</span></div>,document.body)}
 </div>;
}
