import { useEffect, useRef, useState, type ReactNode } from 'react';
type Props = { label: string; value: number; min: number; max: number; step: number; unit?: string; hideValue?: boolean; plainValue?: boolean; hideLabel?: boolean; valueHint?: ReactNode; onChange: (n: number) => void; onCommit: () => void };
export function Parameter({ label, value, min, max, step, unit, hideValue, plainValue, hideLabel, valueHint, onChange, onCommit }: Props) {
  const [editing,setEditing]=useState(false);
  const [text, setText] = useState(String(+value.toFixed(2))), focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(String(+value.toFixed(2))); }, [value]);
  const change = (raw: string) => { if (raw.trim() && Number.isFinite(+raw)) { const next = Math.min(max, Math.max(min, +raw)); if (Math.abs(next - value) > 1e-8) onChange(next); } };
  return <div className="parameter">
    <label className="range-label">{!hideLabel&&<span className="parameter-title" tabIndex={valueHint?0:undefined}>{label}</span>}{valueHint&&<span className="numeric-value parameter-hint">{valueHint}</span>}{!hideValue&&<span className="numeric-value"><input className={plainValue?`plain-number ${editing?'editing':''}`:undefined} readOnly={plainValue&&!editing} onDoubleClick={e=>{if(plainValue){setEditing(true);focused.current=true;e.currentTarget.focus();e.currentTarget.select();}}} aria-label={`${label}数值`} type="number" min={min} max={max} step={step} value={text} onFocus={() => { focused.current = !plainValue || editing; }} onChange={e => { setText(e.target.value); change(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} onBlur={() => { focused.current = false; setEditing(false); setText(String(+value.toFixed(2))); onCommit(); }} />{unit && <span>{unit}</span>}</span>}</label>
    <input className="range" aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e => change(e.target.value)} onPointerUp={onCommit} onKeyUp={onCommit} onBlur={onCommit} />
  </div>;
}
