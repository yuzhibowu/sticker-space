import {Children,cloneElement,isValidElement,useEffect,useLayoutEffect,useRef,useState,type DetailsHTMLAttributes,type ReactElement,type ReactNode} from 'react';
const DURATION=200;
export function AnimatedDetails({children,open:initialOpen=false,className='',onExpandedChange,dismissOnOutside=false,expansionRequest,...props}:DetailsHTMLAttributes<HTMLDetailsElement>&{onExpandedChange?:(open:boolean)=>void;dismissOnOutside?:boolean;expansionRequest?:{id:number;open:boolean}}){
 const [open,setOpen]=useState(initialOpen),[visible,setVisible]=useState(initialOpen);
 const root=useRef<HTMLDetailsElement>(null),finish=useRef<ReturnType<typeof setTimeout>>();
 const container=useRef<HTMLDivElement>(null),inner=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{if(!open||!inner.current||!container.current)return;const measure=()=>{container.current?.style.setProperty('--disclosure-height',`${inner.current?.getBoundingClientRect().height??0}px`);};measure();const observer=new ResizeObserver(measure);observer.observe(inner.current);return()=>observer.disconnect();},[open]);
 useEffect(()=>{
  const element=root.current;if(!element)return;const children=new Set<EventTarget>();
  const change=(event:Event)=>{if(event.target===element)return;const active=(event as CustomEvent<boolean>).detail;if(active)children.add(event.target!);else children.delete(event.target!);element.dataset.childAnimating=String(children.size>0);};
  element.addEventListener('disclosure-motion',change);return()=>element.removeEventListener('disclosure-motion',change);
 },[]);
 useEffect(()=>{
  if(!visible||!/(^| )(video-export|live-photo-export|usdz-export)( |$)/.test(className))return;
  const scrollTimer=setTimeout(()=>{const element=root.current,panel=element?.closest('.panel-scroll');if(!element||!panel)return;const distance=element.getBoundingClientRect().bottom-panel.getBoundingClientRect().bottom+10;if(distance>0)panel.scrollBy({top:distance,behavior:'smooth'});},DURATION+50);
  return()=>clearTimeout(scrollTimer);
 },[visible,className]);
 const desired=useRef(initialOpen),timer=useRef<ReturnType<typeof setTimeout>>(),frame=useRef(0);
 useEffect(()=>()=>{clearTimeout(timer.current);clearTimeout(finish.current);cancelAnimationFrame(frame.current);root.current?.dispatchEvent(new CustomEvent('disclosure-motion',{bubbles:true,detail:false}));},[]);
 useLayoutEffect(()=>{
  if(!expansionRequest)return;
  clearTimeout(timer.current);clearTimeout(finish.current);cancelAnimationFrame(frame.current);
  desired.current=expansionRequest.open;setOpen(expansionRequest.open);setVisible(expansionRequest.open);root.current?.dispatchEvent(new CustomEvent('disclosure-motion',{bubbles:true,detail:false}));
 },[expansionRequest?.id,expansionRequest?.open]);
 const nodes=Children.toArray(children),summary=nodes.find(node=>isValidElement(node)&&node.type==='summary') as ReactElement<any>;
 const content=nodes.filter(node=>node!==summary);
 const toggle=()=>{clearTimeout(finish.current);root.current?.dispatchEvent(new CustomEvent('disclosure-motion',{bubbles:true,detail:true}));finish.current=setTimeout(()=>root.current?.dispatchEvent(new CustomEvent('disclosure-motion',{bubbles:true,detail:false})),DURATION+40);clearTimeout(timer.current);cancelAnimationFrame(frame.current);desired.current=!desired.current;onExpandedChange?.(desired.current);if(desired.current){setOpen(true);frame.current=requestAnimationFrame(()=>{frame.current=requestAnimationFrame(()=>setVisible(true));});}else{setVisible(false);timer.current=setTimeout(()=>setOpen(false),DURATION);}};
 useEffect(()=>{
  if(!dismissOnOutside||!visible)return;
  const outside=(event:PointerEvent)=>{if(desired.current&&event.target instanceof Node&&!root.current?.contains(event.target))toggle();};
  document.addEventListener('pointerdown',outside,true);
  return()=>document.removeEventListener('pointerdown',outside,true);
 },[dismissOnOutside,visible]);
 return <details ref={root} {...props} className={`${className} animated-details ${visible?'is-expanded':''}`} open={open}>
 {summary&&cloneElement(summary,{'aria-expanded':visible,children:(className.includes('property-group')||className.includes('panel-support')||className.includes('preview-help'))?summary.props.children:<><svg className="secondary-disclosure" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m10 8 4 4-4 4"/></svg>{summary.props.children}</>,onClick:(event:React.MouseEvent)=>{if((event.target as Element).closest('a'))return;event.preventDefault();toggle();}})}
 <div ref={container} className="disclosure-content" aria-hidden={!visible}><div ref={inner} className="disclosure-inner">{content as ReactNode}</div></div>
 </details>;
}
