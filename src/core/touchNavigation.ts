export type TouchPoint={x:number;y:number};
export const CANCEL_TOUCH_STICKER='sticker-lab-cancel-touch-sticker';
type Callbacks={enabled:()=>boolean;onStart:(point:TouchPoint)=>{sticker:boolean};onCancelSticker:()=>void;onOrbit:(dx:number,dy:number)=>void;onTap:(point:TouchPoint)=>void;onPinch:(ratio:number,point:TouchPoint)=>void;onEnd:()=>void;requestFrame:(callback:()=>void)=>number;cancelFrame:(id:number)=>void};
/** Single fingers orbit or peel; two fingers always zoom the model, never the sticker. */
export class TouchNavigation{
 private points=new Map<number,TouchPoint>();
 private origin:TouchPoint|null=null;
 private previous:TouchPoint|null=null;
 private action:'idle'|'single'|'sticker'|'orbit'|'pinch'|'release'='idle';
 private pair:{distance:number;x:number;y:number}|null=null;
 private frame:number|null=null;
 private sample(){const [a,b]=[...this.points.values()];return {distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
 private flushPinch(){
  if(this.action!=='pinch'||this.points.size<2||!this.pair)return;
  const next=this.sample(),ratio=next.distance/this.pair.distance;
  if(Math.abs(ratio-1)>.0001)this.callbacks.onPinch(ratio,next);
  this.pair=next;
 }
 suppressClick=false;
 constructor(private callbacks:Callbacks){}
 get active(){return this.points.size>0;}
 down(id:number,point:TouchPoint){
  if(!this.callbacks.enabled())return true;
  this.points.set(id,point);
  if(this.points.size===1){
   this.suppressClick=false;this.origin=point;this.previous=point;
   this.action=this.callbacks.onStart(point).sticker?'sticker':'single';return false;
  }
  this.callbacks.onCancelSticker();this.action='pinch';this.pair=this.sample();this.suppressClick=true;return true;
 }
 move(id:number,point:TouchPoint){
  if(!this.points.has(id)||this.action==='release')return true;
  this.points.set(id,point);
  if(this.action==='pinch'){if(this.frame===null)this.frame=this.callbacks.requestFrame(()=>{this.frame=null;this.flushPinch();});return true;}
  const previous=this.previous??point;this.previous=point;
  if(this.action==='sticker')return false;
  const travel=this.origin?Math.hypot(point.x-this.origin.x,point.y-this.origin.y):0;
  if(this.action==='single'&&travel>10){this.action='orbit';this.suppressClick=true;}
  if(this.action==='orbit')this.callbacks.onOrbit(point.x-previous.x,point.y-previous.y);
  return true;
 }
 end(id:number,activate=true,point?:TouchPoint){
  if(!this.points.has(id))return true;
  if(point)this.points.set(id,point);
  this.flushPinch();let consume=!['single','sticker'].includes(this.action);
  if(this.action==='single'){
   const end=this.points.get(id)!;
   if(activate&&this.callbacks.enabled()&&this.origin&&Math.hypot(end.x-this.origin.x,end.y-this.origin.y)<=10)this.callbacks.onTap(end);
   // Touch releases place directly; discard the browser's later compatibility click.
   this.suppressClick=true;consume=true;
  }
  this.points.delete(id);
  if(this.points.size){this.action='release';return true;}
  this.cleanup();return consume;
 }
 cancel(){if(!this.active)return;this.callbacks.onCancelSticker();this.suppressClick=true;this.cleanup();}
 private cleanup(){if(this.frame!==null)this.callbacks.cancelFrame(this.frame);this.frame=null;this.pair=null;this.points.clear();this.action='idle';this.callbacks.onEnd();}
}
