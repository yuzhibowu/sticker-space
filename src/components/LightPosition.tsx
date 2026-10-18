import {useRef} from 'react';
import type {LightingSettings} from '../core/types';

/** Project the same XYZ Euler direction used by the preview and export light rig. */
export function LightPosition({settings,onChange,onCommit}:{settings:LightingSettings;onChange:(s:LightingSettings,group?:string)=>void;onCommit:()=>void}){
 const dragging=useRef(false),r=Math.PI/180;
 const x=Math.sin(settings.keyAngle*r),y=-Math.sin(settings.keyAngleX*r)*Math.cos(settings.keyAngle*r),z=Math.cos(settings.keyAngleX*r)*Math.cos(settings.keyAngle*r);
 const setPoint=(px:number,py:number,back=z<0)=>{
  const length=Math.hypot(px,py),scale=length>.98?.98/length:1;
  px*=scale;py*=scale;
  const pz=Math.sqrt(Math.max(0,1-px*px-py*py))*(back?-1:1);
  onChange({...settings,keyAngle:Math.asin(px)/r,keyAngleX:Math.atan2(-py,pz)/r},'lighting-position');
 };
 const move=(e:React.PointerEvent<HTMLButtonElement>)=>{const box=e.currentTarget.getBoundingClientRect();setPoint((e.clientX-box.left-box.width/2)/(box.width*.42),-(e.clientY-box.top-box.height/2)/(box.height*.42));};
 return <div className="field light-position-field"><label>灯的位置</label><div className="light-position-layout">
  <button type="button" className="light-position-sphere" aria-label="拖动调整灯的位置" title="拖动光点调整方向，方向键微调" onPointerDown={e=>{dragging.current=true;e.currentTarget.setPointerCapture(e.pointerId);move(e);}} onPointerMove={e=>{if(dragging.current)move(e);}} onPointerUp={e=>{dragging.current=false;e.currentTarget.releasePointerCapture(e.pointerId);onCommit();}} onPointerCancel={()=>{dragging.current=false;onCommit();}} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();onChange({...settings,keyAngle:Math.max(-180,Math.min(180,settings.keyAngle+(e.key==='ArrowRight'?2:e.key==='ArrowLeft'?-2:0))),keyAngleX:Math.max(-180,Math.min(180,settings.keyAngleX+(e.key==='ArrowDown'?2:e.key==='ArrowUp'?-2:0)))},'lighting-position');}} onKeyUp={e=>{if(e.key.startsWith('Arrow'))onCommit();}}>
   <svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="67"/><ellipse cx="80" cy="80" rx="67" ry="24"/><ellipse cx="80" cy="80" rx="24" ry="67"/><path d="M13 80h134M80 13v134"/><path className="light-ray" d={`M80 80L${80+x*67} ${80-y*67}`}/><circle className={`light-position-dot ${z<0?'is-back':''}`} cx={80+x*67} cy={80-y*67} r="7"/></svg>
  </button><div className="light-position-actions"><button type="button" onClick={()=>{setPoint(x,y,z>=0);onCommit();}}>{z<0?'背面光':'正面光'}</button><button type="button" onClick={()=>{onChange({...settings,keyAngle:-5,keyAngleX:-7},'lighting-position');onCommit();}}>靠近正面</button></div>
 </div></div>;
}
