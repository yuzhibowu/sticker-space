import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
const PROJECT_URL='https://github.com/CatsJuice/sticker-forge';
const AUTHOR_URL=PROJECT_URL;

export function PeelCredit({revealed,children}:{revealed:boolean;children:ReactNode}){
 const avatar=useRef<HTMLImageElement>(null),[ready,setReady]=useState(false),[interacted,setInteracted]=useState(false);
 const shown=revealed&&ready;
 useLayoutEffect(()=>{
  let cancelled=false;
  // Keep both sides mounted: warm the avatar before the first peel-mode swap.
  void avatar.current?.decode().catch(()=>{}).then(()=>{if(!cancelled)setReady(true);});
  return()=>{cancelled=true;};
 },[]);
 useLayoutEffect(()=>{if(shown)setInteracted(true);},[shown]);
 return <div className={`peel-corner-swap ${shown?'is-revealed':''} ${interacted?'has-interacted':''}`}>
 <div className="peel-corner-control" aria-hidden={shown} {...(shown?{inert:''}:{})}>{children}</div>
 <div className="peel-credit" aria-hidden={!shown} {...(!shown?{inert:''}:{})}>
  <a className="peel-credit-project" href={PROJECT_URL} target="_blank" rel="noopener noreferrer" aria-label="访问 sticker-forge GitHub 项目">
   <img ref={avatar} src="/credits/open-source.svg" alt="第三方项目链接" width="18" height="18" loading="eager" decoding="async"/><span>sticker-forge</span>
  </a>
  <p>撕纸效果基于<a href={AUTHOR_URL} target="_blank" rel="noopener noreferrer" aria-label="访问 CatsJuice 的小红书主页">@CatsJuice</a> 的开源项目</p>
 </div></div>;
}
