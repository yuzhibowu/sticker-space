import {catPawPose,type CatPawSweep} from '../core/catPaw';
import pawImage from '../assets/cat-paw/white-paw-healthy-foreleg.png';

// Decode ahead of the short sweep, so the first reach never shows an empty paw.
if(typeof Image!=='undefined'){const preload=new Image();preload.src=pawImage;void preload.decode().catch(()=>{});}

/** One photographic furry paw, viewed from the back and clipped to the picture. */
export class CatPawOverlay{
  private viewport:HTMLDivElement;
  private paw:HTMLDivElement;
  private status:'loading'|'ready'|'failed'='loading';
  private disposed=false;
  get ready(){return this.status==='ready';}
  get failed(){return this.status==='failed';}
  constructor(private plan:CatPawSweep,onReady:()=>void=()=>{}){
    this.viewport=document.createElement('div');this.viewport.className='cat-paw-viewport';this.viewport.setAttribute('aria-hidden','true');
    const r=plan.rect;Object.assign(this.viewport.style,{left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`});
    this.paw=document.createElement('div');this.paw.className='cat-paw';
    Object.assign(this.paw.style,{width:`${plan.imageSize.width}px`,transformOrigin:`50% ${plan.anchor}px`});
    const image=document.createElement('img');image.src=pawImage;image.alt='';image.draggable=false;
    Object.assign(image.style,{width:`${plan.imageSize.width}px`,height:`${plan.imageSize.height}px`});this.paw.append(image);
    this.viewport.append(this.paw);document.body.append(this.viewport);this.update(0);
    // Preloading alone is not a readiness guarantee. Decode this displayed image
    // before allowing the paper to be pulled away; retry a failed download once.
    void (async()=>{
      for(let attempt=0;attempt<2;attempt++){
        try{
          if(attempt)image.src=`${pawImage}?retry=1`;
          await image.decode();if(this.disposed)return;
          this.status='ready';onReady();return;
        }catch{if(this.disposed)return;}
      }
      this.status='failed';onReady();
    })();
  }
  update(elapsed:number){
    const pose=catPawPose(this.plan,elapsed);
    this.paw.style.left=`${pose.paw.x-this.plan.rect.left}px`;this.paw.style.top=`${pose.paw.y-this.plan.rect.top}px`;
    this.paw.style.height=`${pose.height}px`;
    this.paw.style.transform=`translate(-50%,-${this.plan.anchor}px) rotate(${this.plan.angle}deg) scale(${pose.scale})`;
    this.paw.classList.toggle('is-grabbing',pose.grabbing);return pose;
  }
  destroy(){this.disposed=true;this.viewport.remove();}
}
