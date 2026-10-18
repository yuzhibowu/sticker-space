import {AnimatedDetails} from './AnimatedDetails';
import {useEffect,useRef} from 'react';
import type {StickerSceneData,MotionSettings} from '../core/types';
import {DEFAULT_MOTION,motionPlan} from '../core/motion';
import {Options} from './VideoExport';
import {Parameter} from './Parameter';
export function AnimationControls({period,onPeriodChange,scene,time,playing,disabled,onChange,onTime,onPlaying,onCommit}:{period:number;onPeriodChange:(period:number)=>void;scene:StickerSceneData;time:number|null;playing:boolean;disabled:boolean;onChange:(m:MotionSettings)=>void;onTime:(t:number|null)=>void;onPlaying:(v:boolean)=>void;onCommit:()=>void}){
 const settings={...(scene.motion??DEFAULT_MOTION),turnDuration:period},plan=motionPlan(scene.stickers,settings),clock=useRef({time:0,tick:0});
 useEffect(()=>{clock.current.time=time??0;},[time]);
 useEffect(()=>{
  if(!playing||disabled)return;
  clock.current.tick=performance.now();let frame=0;
  const tick=(now:number)=>{clock.current.time=Math.min(plan.duration,clock.current.time+(now-clock.current.tick)/1000);clock.current.tick=now;onTime(clock.current.time);if(clock.current.time>=plan.duration)onPlaying(false);else frame=requestAnimationFrame(tick);};
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[playing,disabled,plan.duration,onTime,onPlaying]);
 const patch=(key:keyof MotionSettings,value:number)=>{onPlaying(false);onChange({...settings,[key]:value});};
 const move=(index:number,delta:number)=>{const order=plan.ordered.map(s=>s.id);[order[index],order[index+delta]]=[order[index+delta],order[index]];onChange({...settings,order});onCommit();};
 return <fieldset className="editing-fields animation-controls" disabled={disabled}>
  <AnimatedDetails className="animation-mode-drawer export-drawer"><summary>旋转</summary><label className="checkbox"><input type="checkbox" checked={settings.enabled!==false} onChange={event=>{onChange({...settings,enabled:event.target.checked});onCommit();}}/>启用旋转</label><Options label="旋转" value={settings.mode} choices={[{value:'turntable',label:'循环旋转'},{value:'sequence',label:'逐张贴入 → 旋转 → 定格'}]} onChange={mode=>{onPlaying(false);onTime(null);onChange({...settings,mode});onCommit();}}/>
  <div className="field rotation-direction"><div className="options" role="group" aria-label="旋转方向">{(['left','right'] as const).map(direction=><button key={direction} className={(settings.direction??'right')===direction?'selected':''} onClick={()=>{onChange({...settings,direction});onCommit();}}>{direction==='left'?'左旋':'右旋'}</button>)}</div></div>
  {settings.mode==='sequence'&&<>
   <Parameter label="空场停留" value={settings.intro} min={0} max={10} step={.1} unit="s" onChange={v=>patch('intro',v)} onCommit={onCommit}/>
   <Parameter label="贴入间隔" value={settings.interval} min={.16} max={3} step={.01} unit="s" onChange={v=>patch('interval',v)} onCommit={onCommit}/>

   <Parameter label="定格角度" value={settings.heroAngle} min={-180} max={180} step={1} unit="°" onChange={v=>patch('heroAngle',v)} onCommit={onCommit}/>
   <Parameter label="定格停留" value={settings.hold} min={.25} max={10} step={.05} unit="s" onChange={v=>patch('hold',v)} onCommit={onCommit}/>
   <AnimatedDetails className="animation-order"><summary>贴入顺序 · {plan.ordered.length} 张</summary>{plan.ordered.map((s,i)=><div className="animation-order-row" key={s.id}><span>{i+1}. {scene.assets.find(a=>a.id===s.assetId)?.name??'贴纸'}</span><button aria-label={`第 ${i+1} 张提前`} disabled={disabled||i===0} onClick={()=>move(i,-1)}>↑</button><button aria-label={`第 ${i+1} 张延后`} disabled={disabled||i===plan.ordered.length-1} onClick={()=>move(i,1)}>↓</button></div>)}</AnimatedDetails>
   <div className="animation-preview-actions"><button onClick={()=>{if(time===null||time>=plan.duration)onTime(0);onPlaying(!playing);}}>{playing?'暂停动画':'预览动画'}</button><button onClick={()=>{onPlaying(false);onTime(null);}}>返回编辑</button></div>
   <input aria-label="动画进度" className="animation-scrubber" type="range" min={0} max={plan.duration} step={.01} value={time??0} onChange={e=>{onPlaying(false);onTime(Number(e.target.value));}}/>
   <output className="section-help">{(time??0).toFixed(2)} / {plan.duration.toFixed(2)} s · {time===null?'编辑状态':plan.at(time).phase}</output>
   <p className="section-help">从默认正面立即旋转，贴纸同时逐张贴入，再停在指定角度。预览与导出使用同一条时间轴。</p>
  </>}
 </AnimatedDetails><AnimatedDetails className="rotation-period-drawer export-drawer"><summary>转多久</summary><Parameter hideLabel plainValue label="转多久" value={period} min={1} max={30} step={.1} unit="s" onChange={onPeriodChange} onCommit={onCommit}/></AnimatedDetails>
 </fieldset>;
}
