export const PHONE_SCROLL_DURATION=500;
export function scrollEase(t:number){const p=Math.max(0,Math.min(1,t));return p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;}
type ScrollDriver={position:()=>number;write:(top:number)=>void;now:()=>number;request:(callback:(time:number)=>void)=>number;cancel:(id:number)=>void};
export function animatePhoneScroll(target:number,driver:ScrollDriver){
 const from=driver.position(),to=Math.max(0,target),start=driver.now();let frame:number|null=null,stopped=false;
 const tick=(time:number)=>{if(stopped)return;const progress=Math.min(1,Math.max(0,(time-start)/PHONE_SCROLL_DURATION));driver.write(from+(to-from)*scrollEase(progress));frame=progress<1?driver.request(tick):null;};
 frame=driver.request(tick);
 return()=>{stopped=true;if(frame!==null)driver.cancel(frame);};
}
export function scrollPhonePage(target:number){return animatePhoneScroll(target,{position:()=>window.scrollY,write:top=>window.scrollTo({top,behavior:'auto'}),now:()=>performance.now(),request:callback=>requestAnimationFrame(callback),cancel:id=>cancelAnimationFrame(id)});}
