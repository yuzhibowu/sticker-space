import {LightPosition} from './LightPosition';
import {AnimatedDetails} from './AnimatedDetails';
import {Parameter} from './Parameter';
import {originalLighting,resolveLighting,REMBRANDT_LIGHTING,LIGHTING_RANGES,lightingMatches} from '../core/modelLighting';
import type {LightingSettings,SurfaceData} from '../core/types';
type Props={value?:LightingSettings;surface:SurfaceData;disabled:boolean;onChange:(settings:LightingSettings,group?:string)=>void;onCommit:()=>void};
const FIELDS=[['exposure','曝光强度'],['environmentIntensity','环境光强度'],['keyLightIntensity','主光强度'],['fillLightIntensity','补光强度'],['shadowIntensity','阴影强度'],['keyAngle','主光角度 Y'],['keyAngleX','主光角度 X']] as const;
export function LightingControls({value,surface,disabled,onChange,onCommit}:Props){
 const settings=resolveLighting(value,surface),neutral=originalLighting(surface);
 return <AnimatedDetails className="lighting-drawer export-drawer"><summary>光照</summary><fieldset disabled={disabled}>
  <div className="field"><label>布光模式</label><div className="options"><button className={lightingMatches(settings,neutral)?'selected':''} aria-pressed={lightingMatches(settings,neutral)} onClick={()=>onChange({...neutral})}>中性布光</button><button className={lightingMatches(settings,REMBRANDT_LIGHTING)?'selected':''} aria-pressed={lightingMatches(settings,REMBRANDT_LIGHTING)} onClick={()=>onChange({...REMBRANDT_LIGHTING})}>伦勃朗布光</button></div></div>
  <LightPosition settings={settings} onChange={onChange} onCommit={onCommit}/>
  {FIELDS.map(([key,label])=>{const [min,max,step]=LIGHTING_RANGES[key];return <Parameter key={key} label={label} value={settings[key]} min={min} max={max} step={step} unit={key.startsWith('keyAngle')?'°':undefined} plainValue onChange={n=>onChange({...settings,[key]:n,...(key==='exposure'&&settings.toneMapping==='none'?{toneMapping:'linear' as const}:{})},`lighting-${key}`)} onCommit={onCommit}/>;})}
  <div className="field"><label>色彩映射</label><div className="options">{(['none','aces','linear'] as const).map(toneMapping=><button key={toneMapping} className={settings.toneMapping===toneMapping?'selected':''} aria-pressed={settings.toneMapping===toneMapping} onClick={()=>onChange({...settings,toneMapping})}>{toneMapping==='none'?'原色':toneMapping==='aces'?'ACES':'Linear'}</button>)}</div></div>
 </fieldset></AnimatedDetails>;
}
