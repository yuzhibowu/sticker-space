import {useId,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
export function HoverHint({children,text,disabled=false}:{children:ReactNode;text:string;disabled?:boolean}){
 const id=useId(),anchor=useRef<HTMLSpanElement>(null),bubble=useRef<HTMLSpanElement>(null),[position,setPosition]=useState<{left:number;top:number;above:boolean}|null>(null);
 const show=()=>{if(disabled)return;const rect=anchor.current?.getBoundingClientRect();if(!rect)return;const above=rect.top>=54;setPosition({left:(rect.left+rect.right)/2,top:above?rect.top-8:rect.bottom+8,above});};
 useLayoutEffect(()=>{const node=bubble.current;if(!node||!position)return;const rect=node.getBoundingClientRect();node.style.left=`${Math.max(8,Math.min(window.innerWidth-rect.width-8,position.left-rect.width/2))}px`;node.style.top=`${position.above?position.top-rect.height:position.top}px`;},[position,text]);
 return <span ref={anchor} onPointerEnter={show} onPointerLeave={()=>setPosition(null)} onFocus={show} onBlur={()=>setPosition(null)} aria-describedby={position?id:undefined}>{children}{!disabled&&position&&createPortal(<span ref={bubble} id={id} className="hover-hint-bubble" role="tooltip" style={{left:position.left,top:position.top}}>{text}</span>,document.body)}</span>;
}
