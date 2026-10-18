import {isImageBackground} from '../core/background';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { aspectRatio, type CanvasAspect } from '../export/videoSettings';
export function PreviewFrame({ aspect, background, children, mobile }: { mobile:boolean; aspect: CanvasAspect; background: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null), [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const resize=(availableWidth:number,availableHeight:number)=>{
      const width = mobile ? availableWidth : Math.min(availableWidth, availableHeight * aspectRatio(aspect));
      const height=width/aspectRatio(aspect);
      const stage=box.current?.parentElement;
      if(stage)stage.style.height=mobile?`${height+parseFloat(getComputedStyle(box.current!).top)+parseFloat(getComputedStyle(box.current!).bottom)}px`: "";
      stage?.style.setProperty('--frame-right',`${(availableWidth-width)/2+18}px`);
      stage?.style.setProperty('--frame-bottom',`${(availableHeight-height)/2}px`);
      if(stage&&box.current){
        stage.style.setProperty('--preview-footer-height',`${stage.clientHeight-box.current.offsetTop-availableHeight+(availableHeight-height)/2}px`);
        const panel=stage.parentElement?.querySelector('.panel');
        if(panel)document.documentElement.style.setProperty('--mobile-version-top',`${stage.getBoundingClientRect().bottom-panel.getBoundingClientRect().top-39}px`);
      }
      stage?.style.setProperty('--frame-width',`${width}px`);
      setSize(previous=>previous.width===width&&previous.height===height?previous:{ width, height });
    };
    // Size the frame before its first paint, then track actual layout changes.
    const node=box.current;if(!node)return;
    const initial=node.getBoundingClientRect();resize(initial.width,initial.height);
    const observer = new ResizeObserver(([entry])=>resize(entry.contentRect.width,entry.contentRect.height));
    observer.observe(node);return () => observer.disconnect();
  }, [aspect,mobile]);
  return <div ref={box} className="canvas-area"><div className={`output-frame ${background === 'transparent' ? 'checkerboard' : ''}`} style={{ ...size, backgroundColor: background === 'transparent'||isImageBackground(background) ? undefined : background,...(isImageBackground(background)?{backgroundImage:`url("${background}")`,backgroundSize:'100% 100%',backgroundRepeat:'no-repeat'}:{}) }}>{size.width > 0 && children}</div></div>;
}
