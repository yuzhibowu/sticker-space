import {AnimatedDetails} from './AnimatedDetails';
import {Parameter} from './Parameter';
import {DEFAULT_MODEL_COLOR,MODEL_COLOR_RANGES} from '../core/modelColor';
import type {ModelColorSettings} from '../core/types';
export function ModelColorControls({value,disabled,onChange,onCommit}:{value?:ModelColorSettings;disabled:boolean;onChange:(value:ModelColorSettings,group?:string)=>void;onCommit:()=>void}){
 const settings=value??DEFAULT_MODEL_COLOR;
 return <AnimatedDetails className="lighting-drawer export-drawer"><summary>颜色</summary><fieldset disabled={disabled}>
 {([['saturation','饱和度'],['brightness','明度'],['contrast','对比度']] as const).map(([key,label])=><Parameter key={key} label={label} value={Math.round(settings[key]*100)} min={0} max={MODEL_COLOR_RANGES[key][1]*100} step={1} unit="%" plainValue onChange={n=>onChange({...settings,[key]:n/100},`model-color-${key}`)} onCommit={onCommit}/>)}
 <button className="text-button" onClick={()=>onChange({...DEFAULT_MODEL_COLOR})}>恢复原色</button>
 </fieldset></AnimatedDetails>;
}
