import {CursorInput} from '../core/cursorInput';
import {createPortal} from 'react-dom';
import {cursorPress} from '../scene/cursorPress';
import {useEffect,useRef} from 'react';
/** Screen position updates avoid React renders; only cursor scale is animated. */
export function RoundedCursor(){
  const cursor=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const input=new CursorInput();
    const finePointer=window.matchMedia('(any-pointer: fine)');
    const isMouse=(event:PointerEvent|MouseEvent)=>input.accepts(event,performance.now(),finePointer.matches);
    const move=(event:PointerEvent|MouseEvent)=>{
      const element=cursor.current;if(!element)return;
      if(!isMouse(event)){element.style.opacity='0';cancel();return;}
      element.style.left=`${event.clientX}px`;element.style.top=`${event.clientY}px`;
      element.style.opacity='1';
      const target=event.target as Element;
      element.style.setProperty('--cursor-scale',target.closest('.panel')?'0.7':'1');
      element.dataset.overPreview=String(!!target.closest('.stage canvas'));
    };
    let releaseTimer:ReturnType<typeof setTimeout>|undefined;
    let pressedAt=0;
    const setPressed=(pressed:boolean)=>{cursorPress.pressed=pressed;cursor.current?.style.setProperty('--cursor-press',pressed?'0.8':'1');window.dispatchEvent(new Event('cursor-press-change'));};
    const press=(event?:PointerEvent)=>{if(event&&!isMouse(event)){hideOnBlur();cancel();return;}clearTimeout(releaseTimer);pressedAt=performance.now();setPressed(true);};
    // Trackpad taps can deliver down/up in the same frame: retain the feedback
    // long enough to be visible, and also handle synthetic click-only taps.
    const release=()=>{clearTimeout(releaseTimer);releaseTimer=setTimeout(()=>setPressed(false),Math.max(0,160-(performance.now()-pressedAt)));};
    const tap=(event:MouseEvent)=>{if(!isMouse(event))return;move(event);press();release();};
    const cancel=()=>{clearTimeout(releaseTimer);setPressed(false);};
    window.addEventListener('click',tap,true);
    window.addEventListener('pointerdown',press,true);window.addEventListener('pointerup',release,true);window.addEventListener('pointercancel',release,true);window.addEventListener('blur',cancel);
    const hide=(event:PointerEvent)=>{
      // Removing a hovered menu item can send a leave event while the pointer
      // is still in the document. Only a real viewport exit hides the overlay.
      if(event.clientX>0&&event.clientX<window.innerWidth&&event.clientY>0&&event.clientY<window.innerHeight)return;
      if(cursor.current)cursor.current.style.opacity='0';
    };
    const hideOnBlur=()=>{if(cursor.current)cursor.current.style.opacity='0';};
    const touch=()=>{input.touch(performance.now());hideOnBlur();cancel();};
    window.addEventListener('touchstart',touch,{capture:true,passive:true});
    const pointerChanged=()=>{if(!finePointer.matches){hideOnBlur();cancel();}};
    finePointer.addEventListener('change',pointerChanged);
    window.addEventListener('pointerover',move,{passive:true,capture:true});
    window.addEventListener('pointerdown',move,{passive:true,capture:true});
    window.addEventListener('pointermove',move,{passive:true,capture:true});document.addEventListener('pointerleave',hide);window.addEventListener('blur',hideOnBlur);
    return()=>{window.removeEventListener('touchstart',touch,true);finePointer.removeEventListener('change',pointerChanged);window.removeEventListener('pointerdown',press,true);window.removeEventListener('pointerup',release,true);window.removeEventListener('pointercancel',release,true);window.removeEventListener('blur',cancel);window.removeEventListener('click',tap,true);clearTimeout(releaseTimer);cursorPress.pressed=false;window.removeEventListener('pointermove',move,true);document.removeEventListener('pointerleave',hide);window.removeEventListener('blur',hideOnBlur);window.removeEventListener('pointerover',move,true);window.removeEventListener('pointerdown',move,true);};
  },[]);
  return createPortal(<div ref={cursor} className="rounded-cursor" aria-hidden="true"><img src="/cursors/sticker-rounded.svg?v=folio" alt=""/></div>,document.body);
}
