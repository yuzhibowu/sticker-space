import {AnimatedDetails} from './AnimatedDetails';
import {Parameter} from './Parameter';
import {DEFAULT_FLOATING} from '../core/floating';
import type {FloatingSettings} from '../core/types';
export function FloatingControls({value,period,disabled,onChange,onPeriodChange,onCommit}:{value?:FloatingSettings;period:number;disabled:boolean;onChange:(value:FloatingSettings,group?:string)=>void;onPeriodChange:(period:number)=>void;onCommit:()=>void}){
 const settings=value??DEFAULT_FLOATING;
 return <AnimatedDetails className="floating-drawer export-drawer"><summary>漂浮</summary><fieldset disabled={disabled}>
  <label className="checkbox"><input type="checkbox" checked={settings.enabled} onChange={event=>onChange({...settings,enabled:event.target.checked})}/>启用漂浮</label>
  <Parameter label="漂浮幅度" value={settings.amount} min={0} max={3} step={.05} unit="×" onChange={amount=>onChange({...settings,amount},'floating-amount')} onCommit={onCommit}/>
  <Parameter label="漂浮节奏" value={Number((4/period).toFixed(2))} min={.15} max={4} step={.01} unit="×" onChange={speed=>onPeriodChange(Number((4/speed).toFixed(2)))} onCommit={onCommit}/>
  <button className="text-button" onClick={()=>{onChange({...settings,amount:1});onPeriodChange(4);onCommit();}}>恢复默认</button>
 </fieldset></AnimatedDetails>;
}
