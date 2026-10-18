import {stickerCarry,previewSizeBlend} from '../scene/stickerCarry';
import {cursorPress} from '../scene/cursorPress';
import {previewImage} from '../core/assets';
import {loadStickerPreview} from '../core/stickerPreview';
import {createPortal} from 'react-dom';
import {useEffect,useLayoutEffect,useRef} from 'react';
import type {StickerAsset} from '../core/types';
/** The carried paper stays in one top-level overlay, including over a surface. */
export function StickerFollower({asset,enabled,onSurface,size,rotation,origin,previewPixels,surfaceTransform,surfaceCursorTransform,hidden=false}:{hidden?:boolean;asset:StickerAsset;enabled:boolean;onSurface:boolean;size:number;rotation:number;origin:{x:number;y:number;extent:number}|null;previewPixels:(x:number,y:number)=>number;surfaceTransform:(scale:number)=>string|null;surfaceCursorTransform:(scale:number)=>string|null}){
 const cursor=useRef<HTMLDivElement>(null),image=useRef<HTMLDivElement>(null),print=useRef<HTMLImageElement>(null),pointer=useRef({x:0,y:0}),refresh=useRef(()=>{});
 useLayoutEffect(()=>{
  const node=print.current;if(!enabled||!node)return;
  return loadStickerPreview(asset.image,source=>{node.src=source;refresh.current();});
 },[enabled,asset.image]);
 const current=useRef({size,previewPixels,onSurface,origin,rotation,surfaceTransform,surfaceCursorTransform});current.current={size,previewPixels,onSurface,origin,rotation,surfaceTransform,surfaceCursorTransform};
 const library=asset.id.startsWith('demo-')?'.default-sticker-assets.is-expanded .disclosure-content':'.imported-sticker-assets.is-expanded .disclosure-content';
 const region=`${library}, .canvas-area`;
 const visibleAt=(target:Element|null,x:number,y:number)=>{
  if(target?.closest(region))return true;
  // The panel padding and resize handle sit between the library and preview.
  // Bridge that strip only beside this sticker's own library, preserving the
  // hidden cursor preview over unrelated property fields.
  const content=document.querySelector(library)?.getBoundingClientRect(),panel=document.querySelector('.panel')?.getBoundingClientRect();
  return !!content&&!!panel&&x>=panel.left-4&&x<=content.left&&y>=content.top&&y<=content.bottom;
 };
 useEffect(()=>{
  if(!enabled)return;
  stickerCarry.pixels=origin?.extent??30;
  let animation=0,lastFrame=performance.now(),extent=origin?.extent??30;
  const draw=()=>{
   const node=image.current;if(!node)return;
   const {x,y}=pointer.current,base=current.current.origin?.extent??30;
   const pixels=current.current.previewPixels(x,y),blend=stickerCarry.inside?stickerCarry.previewScale:0;
   const targetExtent=base+(pixels-base)*blend,now=performance.now();
   // Retarget from the size already displayed, never restart at the small size
   // when overlapping canvas/resizer hit targets alternate near the boundary.
   const delta=Math.min(50,Math.max(0,now-lastFrame));lastFrame=now;
   extent+=(targetExtent-extent)*(1-Math.exp(-delta/35));
   if(Math.abs(targetExtent-extent)<.05)extent=targetExtent;
   const projected=stickerCarry.inside&&current.current.onSurface?current.current.surfaceTransform(extent/Math.max(1,pixels)):null;
   const cursorNode=cursor.current;if(cursorNode){const matrix=projected?current.current.surfaceCursorTransform(1):null;cursorNode.style.display=matrix?'block':'none';cursorNode.style.setProperty('--cursor-press',cursorPress.pressed?'0.8':'1');if(matrix)cursorNode.style.transform=matrix;}
   if(projected){node.style.left='0';node.style.top='0';node.style.width='100px';node.style.height='100px';node.style.objectFit='fill';node.style.transformOrigin='0 0';node.style.transform=projected;}
   else {node.style.left=`${x}px`;node.style.top=`${y}px`;node.style.width=`${extent}px`;node.style.height=`${extent}px`;node.style.objectFit='contain';node.style.transformOrigin='center';node.style.transform=`translate(-50%,-50%) rotate(${-current.current.rotation}deg)`;}
   if(extent!==targetExtent)animation=requestAnimationFrame(draw);
  };
  refresh.current=()=>{cancelAnimationFrame(animation);draw();};
  const move=(event:PointerEvent)=>{
   const node=image.current;if(!node)return;
   const target=event.target as Element;
   node.style.display=visibleAt(target,event.clientX,event.clientY)?'block':'none';
   // Use coordinates, not the event target: the resize handle overlaps the
   // first preview pixels, so target-based checks rapidly flip at that seam.
   const preview=document.querySelector('.canvas-area')?.getBoundingClientRect();
   stickerCarry.inside=!!preview&&event.clientX>=preview.left&&event.clientX<preview.right&&event.clientY>=preview.top&&event.clientY<=preview.bottom;
   stickerCarry.previewScale=previewSizeBlend(event.clientX);pointer.current={x:event.clientX,y:event.clientY};
   refresh.current();
  };
  if(origin&&image.current){pointer.current={x:origin.x,y:origin.y};image.current.style.display=visibleAt(document.elementFromPoint(origin.x,origin.y),origin.x,origin.y)?'block':'none';draw();}
  const hide=()=>{if(image.current)image.current.style.display='none';if(cursor.current)cursor.current.style.display='none';};
  window.addEventListener('cursor-press-change',refresh.current);
  window.addEventListener('pointermove',move,{capture:true,passive:true});window.addEventListener('blur',hide);document.addEventListener('pointerleave',hide);
  return()=>{cancelAnimationFrame(animation);window.removeEventListener('cursor-press-change',refresh.current);refresh.current=()=>{};stickerCarry.inside=false;window.removeEventListener('pointermove',move,true);window.removeEventListener('blur',hide);document.removeEventListener('pointerleave',hide);hide();};
 },[enabled,origin,region]);
 useEffect(()=>{refresh.current();},[hidden,previewPixels,onSurface,surfaceTransform,surfaceCursorTransform,rotation]);
 return enabled?createPortal(<><div ref={image} className="sticker-follower" aria-hidden="true" style={{opacity:hidden?0:1}}><img key={asset.image} ref={print} src={previewImage(asset.image,true)} alt="" onLoad={()=>refresh.current()}/></div><div ref={cursor} className="sticker-surface-cursor" aria-hidden="true" style={{opacity:hidden?0:1}}><img src="/cursors/sticker-rounded.svg?v=folio" alt=""/></div></>,document.body):null;
}
