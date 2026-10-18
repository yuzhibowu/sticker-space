import {loadStickerPreview} from '../core/stickerPreview';
import {useLayoutEffect,useEffect,useRef,type PointerEvent} from 'react';
import {SLAP_DURATION} from '../core/timeline';
import {previewImage} from '../core/assets';
import type {StickerAsset} from '../core/types';

/** A camera-sized, draggable paper preview; never a fixed-size library thumbnail. */
export function MobileDraftSticker({enabled,asset,dimensions,onDrop}:{onDrop:(x:number,y:number)=>boolean;enabled:boolean;asset:StickerAsset;dimensions:()=>{width:number;height:number;angle:number}|null}){
 const refillAnimation=useRef<Animation|null>(null);
 const drag=useRef<{id:number;x:number;y:number;dx:number;dy:number}|null>(null);
 const finish=(event:PointerEvent<HTMLDivElement>)=>{
  const state=drag.current;if(!state||state.id!==event.pointerId)return;
  event.preventDefault();event.stopPropagation();drag.current=null;
  const placed=event.type==='pointerup'&&onDrop(event.clientX-state.dx,event.clientY-state.dy);
  const node=root.current;if(!node)return;
  node.style.transform='';
  if(placed){
   refillAnimation.current?.cancel();
   refillAnimation.current=node.animate([
    {transform:'scale(.15)',opacity:0,offset:0},
    {transform:'scale(1.08)',opacity:1,offset:.75},
    {transform:'scale(1)',opacity:1,offset:1},
   ],{delay:SLAP_DURATION*1000+200,duration:500,fill:'backwards',easing:'cubic-bezier(.22,.61,.36,1)'});
  }
 };
 const root=useRef<HTMLDivElement>(null),image=useRef<HTMLImageElement>(null),current=useRef(dimensions);current.current=dimensions;
 useEffect(()=>{
  if(!enabled){drag.current=null;refillAnimation.current?.cancel();return;}let frame=0,last='';
  const draw=()=>{
   const size=current.current(),node=root.current,print=image.current;
   if(size&&node&&print){
    const key=`${size.width},${size.height},${size.angle}`;
    if(key!==last){last=key;const extent=Math.hypot(size.width,size.height);
     Object.assign(node.style,{width:`${extent}px`,height:`${extent}px`,visibility:'visible'});
     Object.assign(print.style,{width:`${size.width}px`,height:`${size.height}px`,transform:`translate(-50%,-50%) rotate(${size.angle}deg)`});
    }
   }
   frame=requestAnimationFrame(draw);
  };
  draw();return()=>cancelAnimationFrame(frame);
 },[enabled,asset.id]);
 useLayoutEffect(()=>{if(!enabled)return;return loadStickerPreview(asset.image,source=>{if(image.current)image.current.src=source;});},[enabled,asset.image]);
 useEffect(()=>()=>refillAnimation.current?.cancel(),[]);
 if(!enabled)return null;
 return <div ref={root} className="mobile-draft-sticker" role="button" aria-label="按住贴纸拖到模型上，松手贴上" onContextMenu={event=>event.preventDefault()}
 onPointerDown={event=>{if(drag.current||event.button!==0)return;refillAnimation.current?.cancel();event.preventDefault();event.stopPropagation();const rect=event.currentTarget.getBoundingClientRect();drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,dx:event.clientX-(rect.left+rect.width/2),dy:event.clientY-(rect.top+rect.height/2)};event.currentTarget.setPointerCapture(event.pointerId);}}
 onPointerMove={event=>{const state=drag.current;if(!state||state.id!==event.pointerId)return;event.preventDefault();event.stopPropagation();event.currentTarget.style.transform=`translate3d(${event.clientX-state.x}px,${event.clientY-state.y}px,0)`;}}
 onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}><img ref={image} src={previewImage(asset.image,true)} alt="" draggable={false}/></div>;
}
