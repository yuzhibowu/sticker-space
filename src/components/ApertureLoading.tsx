import {useLayoutEffect,useRef,useState} from 'react';
const BLADES=8,OPEN_MS=700,CLOSE_MS=500,CLOSED_HOLD_MS=120,READY_FADE_MS=180;
/** Rigid crescent leaves; every copy has its own fixed peripheral pivot. */
// Curved leaves share one center; the outer overlap prevents gaps while pivoting.
export function ApertureLoading({busy,error,onRetry,onClosed}:{busy:boolean;error:string;onRetry:()=>void;onClosed?:()=>void}){
 const [visible,setVisible]=useState(true),[closed,setClosed]=useState(true),closedAt=useRef(performance.now());
 const closedNotification=useRef(onClosed);closedNotification.current=onClosed;
 const leaves=useRef<(HTMLImageElement|null)[]>([]);
 const firstLoad=useRef(true);
 useLayoutEffect(()=>{
  if(busy||error){
   // Keep the old scene visible while rigid leaves rotate back to their center.
   setVisible(true);setClosed(true);return;
  }
  let frame=0;
  const start=setTimeout(()=>{frame=requestAnimationFrame(()=>setClosed(false));},Math.max(READY_FADE_MS,CLOSED_HOLD_MS-(performance.now()-closedAt.current)));
  return()=>{cancelAnimationFrame(frame);clearTimeout(start);};
 },[busy,error]);
 useLayoutEffect(()=>{
  if(!visible)return;
  let cancelled=false,frame=0;
  const animations:Animation[]=[];
  const images=leaves.current.filter((leaf):leaf is HTMLImageElement=>Boolean(leaf));
  const start=async()=>{
   // Decode and rasterize once while closed; compositor transforms reuse the metal texture.
   await Promise.all(images.map(image=>image.decode().catch(()=>{})));
   if(cancelled)return;
   frame=requestAnimationFrame(()=>{
    if(cancelled)return;
    const target=closed?'rotate(0deg)':'rotate(-65deg)';
    for(const image of images){
     const from=getComputedStyle(image).transform;
     image.style.transform=target;
     animations.push(image.animate([{transform:from},{transform:target}],{duration:closed?CLOSE_MS:OPEN_MS,easing:'ease-in-out'}));
    }
    void Promise.all(animations.map(animation=>animation.finished)).then(()=>{
     if(cancelled)return;
     if(closed){closedAt.current=performance.now();closedNotification.current?.();}
     else{firstLoad.current=false;setVisible(false);}
    }).catch(()=>{});
   });
  };
  void start();
  return()=>{cancelled=true;cancelAnimationFrame(frame);images.forEach(image=>{const transform=getComputedStyle(image).transform;image.style.transform=transform;});animations.forEach(animation=>animation.cancel());};
 },[closed,visible]);
 if(!visible)return null;
 // A newly selected bundled/custom model can spend a while decoding on its first visit.
 // Keep the same visible progress cue used by the initial page load for every busy iris.
 const waiting=busy&&closed&&!error;
 return <div className={`aperture-loading ${firstLoad.current?'is-initial':''} ${waiting?'is-waiting':''} ${!busy?'is-ready':''} ${closed?'is-closed':'is-opening'}`} role="status" aria-label={error||'Loading model'}>
  {waiting&&<div className="initial-loading"><i aria-hidden="true"/><span>Loading<b className="loading-sweep" aria-hidden="true"><b>Loading</b></b></span></div>}
  <div className="aperture-iris" aria-hidden="true">
   {Array.from({length:BLADES},(_,i)=><div className="iris-leaf-orientation" key={i} style={{transform:`rotate(${i*360/BLADES}deg)`}}><img className="iris-leaf-image" ref={element=>{leaves.current[i]=element;}} src="/iris-blade.svg" alt="" draggable={false} style={{transform:firstLoad.current?'rotate(0deg)':'rotate(-65deg)'}}/></div>)}
  </div>
  {error&&<div className="aperture-status"><span>{error}</span><button onClick={onRetry}>重新加载</button></div>}
 </div>;
}
