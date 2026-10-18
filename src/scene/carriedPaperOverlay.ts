import {previewImage} from '../core/assets';
import type {ScreenRect} from '../core/catPaw';

/** Fully lifted paper is a page overlay, so models, canvas clipping and panel layers cannot hide it. */
export class CarriedPaperOverlay{
  private viewport:HTMLDivElement;
  private rect:ScreenRect|null=null;
  private image:HTMLImageElement;
  constructor(source:string){
    this.viewport=document.createElement('div');this.viewport.className='carried-paper-viewport';
    this.image=document.createElement('img');this.image.className='carried-paper-overlay';
    this.image.src=previewImage(source);this.image.alt='';this.image.setAttribute('aria-hidden','true');
    this.image.style.display='none';this.viewport.append(this.image);document.body.append(this.viewport);
  }
  clipTo(rect:ScreenRect){
    this.rect=rect;
    Object.assign(this.viewport.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,overflow:'hidden'});
  }
  update(x:number,y:number,width:number,height:number,roll:number,visible=true){
    Object.assign(this.image.style,{left:`${x-(this.rect?.left??0)}px`,top:`${y-(this.rect?.top??0)}px`,width:`${width}px`,height:`${height}px`,display:visible?'block':'none',transform:`translate(-50%,-50%) rotate(${-roll*180/Math.PI}deg)`});
  }
  destroy(){this.viewport.remove();}
}
