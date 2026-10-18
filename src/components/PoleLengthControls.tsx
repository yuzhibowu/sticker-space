import {Parameter} from './Parameter';
import {exposedPoleLength,type PoleSurface} from '../core/poleDimensions';
export function PoleLengthControls({surface,onChange,onCommit}:{surface:PoleSurface;onChange:(side:'upper'|'lower',length:number)=>void;onCommit:()=>void}){
  return <section className="section-group">
    {surface.kind==='sign'&&<div className="section-label">杆身长度</div>}
    <Parameter label="上方杆长" value={exposedPoleLength(surface,'upper')} min={surface.kind==='sign'?0:.2} max={surface.kind==='sign'?10:12} step={.01} unit="m" onChange={n=>onChange('upper',n)} onCommit={onCommit}/>
    <Parameter label="下方杆长" value={exposedPoleLength(surface,'lower')} min={surface.kind==='sign'?0:.2} max={surface.kind==='sign'?10:12} step={.01} unit="m" onChange={n=>onChange('lower',n)} onCommit={onCommit}/>
  </section>;
}
