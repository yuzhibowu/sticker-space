import {useEffect,useLayoutEffect,useRef,useState,type PointerEvent} from 'react';

function MobileSlider({label,value,min,max,step,onChange,onCommit}:{label:string;value:number;min:number;max:number;step:number;onChange:(value:number)=>void;onCommit:()=>void}){
 const [local,setLocal]=useState(value),active=useRef(false);
 useLayoutEffect(()=>{if(!active.current)setLocal(value);},[value]);
 const commit=()=>{active.current=false;onCommit();};
 return <input type="range" aria-label={label} min={min} max={max} step={step} value={local} onPointerDown={()=>{active.current=true;}}
  onChange={event=>{const next=Number(event.target.value);setLocal(next);onChange(next);}}
  onPointerUp={commit} onPointerCancel={commit} onKeyUp={commit} onBlur={commit}/>;
}

export function MobileStickerControls({phone,size,angle,disabled,onSize,onAngle,onCommit}:{phone:boolean;size:number;angle:number;disabled:boolean;onSize:(value:number)=>void;onAngle:(value:number)=>void;onCommit:()=>void}){
 if(!phone)return null;
 return <fieldset className="mobile-sticker-controls" disabled={disabled} aria-label="调整贴纸">
  <label><span className="group-title">贴纸角度</span><MobileSlider label="手机贴纸角度" min={-180} max={180} step={1} value={angle} onChange={onAngle} onCommit={onCommit}/></label>
  <label><span className="group-title">贴纸大小</span><MobileSlider label="手机贴纸大小" min={.04} max={4.4} step={.01} value={size} onChange={onSize} onCommit={onCommit}/></label>
 </fieldset>;
}

export function MobileModelPan({phone,disabled,onStart,onMove,onEnd}:{phone:boolean;disabled:boolean;onStart:()=>void;onMove:(dx:number,dy:number)=>void;onEnd:()=>void}){
 const drag=useRef<{pointer:number;startX:number;startY:number;x:number;y:number}|null>(null);
 const [offset,setOffset]=useState({x:0,y:0}),[pressed,setPressed]=useState(false);
 const end=()=>{if(!drag.current)return;drag.current=null;setPressed(false);setOffset({x:0,y:0});onEnd();};
 const endRef=useRef(end);endRef.current=end;
 useEffect(()=>{const blur=()=>endRef.current();window.addEventListener('blur',blur);return()=>{window.removeEventListener('blur',blur);endRef.current();};},[]);
 useEffect(()=>{if(disabled)endRef.current();},[disabled]);
 const finish=(event:PointerEvent<HTMLButtonElement>)=>{
  if(drag.current?.pointer!==event.pointerId)return;
  event.preventDefault();event.stopPropagation();end();
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 };
 if(!phone)return null;
 return <>
  {pressed&&<span className="touch-pan-indicator" role="status" aria-label="模型移动已开启"/>}
  <button className={`mobile-model-pan ${pressed?'is-pressed':''}`} aria-label="按住拖动模型" aria-pressed={pressed} disabled={disabled} style={{transform:`translate(${offset.x}px,${offset.y}px)`}}
   onContextMenu={event=>event.preventDefault()}
   onPointerDown={event=>{
    if(disabled||event.button!==0||drag.current)return;
    event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
    drag.current={pointer:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY};setPressed(true);onStart();
   }}
   onPointerMove={event=>{
    const state=drag.current;if(!state||state.pointer!==event.pointerId)return;
    event.preventDefault();event.stopPropagation();onMove(event.clientX-state.x,event.clientY-state.y);
    state.x=event.clientX;state.y=event.clientY;setOffset({x:state.x-state.startX,y:state.y-state.startY});
   }} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/></svg>
  </button>
 </>;
}

export function MobileStickerPicker({phone,disabled,onClick}:{phone:boolean;disabled:boolean;onClick:()=>void}){
 if(!phone)return null;
 return <button className="mobile-sticker-picker" aria-label="快速选择默认贴纸" disabled={disabled} onClick={onClick}><svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.6 2.5 4.2 14h6.7l-.5 7.5L20 10h-6.8l.4-7.5Z"/></svg></button>;
}
