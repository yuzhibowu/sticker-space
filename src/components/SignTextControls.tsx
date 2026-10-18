import {svgFromPaste,svgFromClipboardText,nativeVector,ClipboardHelperUnavailable,CLIPBOARD_HELPER_DOWNLOAD} from '../core/clipboardVector';
import {useEffect,useRef,useState} from 'react';
import {parseSignIcon} from '../core/signIcon';
import {Parameter} from './Parameter';
import type {SurfaceData} from '../core/types';
import type {SceneAction} from '../core/StickerManager';
type Props={surface:Extract<SurfaceData,{kind:'sign'}>;dispatch:(action:SceneAction)=>void;onNavigate:()=>void;onFont:(file?:File|'alimama'|'fangyuan')=>void;onView:(back:boolean)=>void};
export function SignTextControls({surface,dispatch,onNavigate,onFont}:Props){
  const input=useRef<HTMLInputElement>(null),svgInput=useRef<HTMLInputElement>(null);
  const [error,setError]=useState(''),[needsHelper,setNeedsHelper]=useState(false),[pasting,setPasting]=useState(false);
  const section=useRef<HTMLElement>(null),busy=useRef(false);
  const applyIcon=(source:string,name='剪贴板矢量图.svg')=>{const icon=parseSignIcon(source,name);onNavigate();dispatch({type:'sign-style',style:{icon,iconScale:1,iconRotation:0,iconX:0,iconY:0,iconColor:'#000000'}});setError('');setNeedsHelper(false);};
  const run=async(action:()=>Promise<void>)=>{if(busy.current)return;busy.current=true;setPasting(true);setNeedsHelper(false);try{await action();}catch(error){setError(error instanceof Error?error.message:String(error));setNeedsHelper(error instanceof ClipboardHelperUnavailable);}finally{busy.current=false;setPasting(false);}};
  const upload=async(file?:File)=>{if(!file)return;await run(async()=>applyIcon(file.type==='application/pdf'||/\.pdf$/i.test(file.name)?await nativeVector(file):await file.text(),file.name));};
  const paste=()=>run(async()=>{
    let source:string|null=null;
    try{
      for(const item of await navigator.clipboard.read()){
        if(item.types.includes('image/svg+xml')){source=await (await item.getType('image/svg+xml')).text();break;}
        if(item.types.includes('application/pdf')){source=await nativeVector(await item.getType('application/pdf'));break;}
        for(const type of ['text/html','text/plain'])if(item.types.includes(type)){source=svgFromClipboardText(await (await item.getType(type)).text());if(source)break;}
        if(source)break;
      }
    }catch(error){if(error instanceof ClipboardHelperUnavailable)throw error;}
    if(!source)source=await nativeVector();
    applyIcon(source);
  });
  useEffect(()=>{
    const listener=(event:ClipboardEvent)=>{
      if(!event.clipboardData||section.current?.closest('fieldset')?.disabled||busy.current)return;
      if((event.target as HTMLElement).closest?.('input,textarea,[contenteditable="true"]'))return;
      const data=event.clipboardData,plain=data.getData('text/plain'),html=data.getData('text/html');
      if(plain&&!/<svg\b|data:image\/svg/i.test(plain+html)&&!data.files.length&&!/<img\b/i.test(html))return;
      event.preventDefault();void run(async()=>{const source=await svgFromPaste(data),pdf=Array.from(data.files).find(f=>f.type==='application/pdf'||/\.pdf$/i.test(f.name));applyIcon(source??await nativeVector(pdf));});
    };
    document.addEventListener('paste',listener);return()=>document.removeEventListener('paste',listener);
  },[surface.id,dispatch,onNavigate]);
  const commit=()=>dispatch({type:'commit'});
  const style=(changes:Partial<Pick<Extract<SurfaceData,{kind:'sign'}>,'textScale'|'lineSpacing'|'font'|'icon'|'iconScale'|'iconRotation'|'iconX'|'iconY'|'iconColor'>>,group?:string)=>{onNavigate();dispatch({type:'sign-style',style:changes,group});};
  return <section ref={section} className="section-group sign-text-editor" onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();}} onDrop={e=>{e.preventDefault();if(section.current?.closest('fieldset')?.disabled)return;const file=Array.from(e.dataTransfer.files).find(f=>/\.(svg|pdf)$/i.test(f.name));if(file)void upload(file);}}>
    <div className="options sign-icon-actions"><button onClick={()=>svgInput.current?.click()}>{surface.icon?'替换 SVG 图标':'导入 SVG 图标'}</button><button disabled={pasting} onClick={()=>void paste()} title="也可直接按 ⌘V 粘贴">{pasting?'正在读取…':'粘贴图标'}</button>{surface.icon&&<button onClick={()=>{style({icon:undefined});setError('');}}>恢复文字</button>}</div>
    <input ref={svgInput} hidden type="file" accept=".svg,.pdf,image/svg+xml,application/pdf" aria-label="导入路牌 SVG 图标" onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/>
    {error&&<p className="sign-icon-error" role="alert">{error}{needsHelper&&<> <a href={CLIPBOARD_HELPER_DOWNLOAD} download>下载新版助手</a></>}</p>}
    {surface.icon?<>
      <Parameter label="图标大小" value={(surface.iconScale??1)*100} min={25} max={300} step={1} unit="%" plainValue onChange={n=>style({iconScale:n/100},'sign-icon-size')} onCommit={commit}/>
      <Parameter label="图标角度" value={surface.iconRotation??0} min={-180} max={180} step={1} unit="°" plainValue onChange={n=>style({iconRotation:n},'sign-icon-angle')} onCommit={commit}/>
      <Parameter label="水平位置" value={(surface.iconX??0)*100} min={-150} max={150} step={1} plainValue onChange={n=>style({iconX:n/100},'sign-icon-x')} onCommit={commit}/>
      <Parameter label="垂直位置" value={(surface.iconY??0)*100} min={-150} max={150} step={1} plainValue onChange={n=>style({iconY:n/100},'sign-icon-y')} onCommit={commit}/>
      <div className="field sign-icon-color"><label htmlFor="sign-icon-color">图标颜色</label><div className="options"><input id="sign-icon-color" aria-label="图标颜色" type="color" value={surface.iconColor??surface.icon.shapes[0].color} onFocus={onNavigate} onInput={e=>style({iconColor:e.currentTarget.value},'sign-icon-color')} onChange={e=>style({iconColor:e.target.value},'sign-icon-color')} onBlur={commit}/><button onClick={()=>style({iconColor:undefined})}>恢复原色</button></div></div>
    </>:<>
    <label htmlFor="sign-text">路牌文字</label>
    <textarea id="sign-text" aria-label="路牌文字" maxLength={80} rows={3} value={surface.text} onFocus={onNavigate} onChange={e=>dispatch({type:'sign-text',text:e.target.value})} onBlur={commit}/>
    <p className="section-help">支持中文、英文 · 换行分行，最多三行</p>
    <div className="options"><button onClick={()=>input.current?.click()}>上传字体</button>{surface.font&&<button onClick={()=>style({font:undefined})}>恢复默认字体</button>}</div>
    <input ref={input} className="visually-hidden" type="file" accept=".ttf,.otf,.woff" aria-label="上传路牌字体" onChange={e=>{onFont(e.target.files?.[0]);e.target.value='';}}/>
    <p className="section-help font-name">{surface.font?.name??'默认字体'} · TTF / OTF / WOFF</p>
    <Parameter label="文字大小" value={(surface.textScale??1)*100} min={25} max={300} step={1} unit="%" onChange={n=>style({textScale:n/100},'sign-size')} onCommit={commit}/>
    <Parameter label="行间距" value={surface.lineSpacing??.72} min={.3} max={1.5} step={.01} unit="m" onChange={n=>style({lineSpacing:n},'sign-spacing')} onCommit={commit}/>
    </>}
  </section>;
}
