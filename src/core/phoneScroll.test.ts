import {expect,it,vi} from 'vitest';
import {animatePhoneScroll,scrollEase,PHONE_SCROLL_DURATION} from './phoneScroll';
it('上下两个方向在500ms内使用相同缓入缓出曲线，精确回到目标位置',()=>{
 for(const [from,to] of [[0,800],[800,0]]){
  const frames=new Map<number,(time:number)=>void>();let id=0;const write=vi.fn();
  animatePhoneScroll(to,{position:()=>from,write,now:()=>0,request:fn=>{frames.set(++id,fn);return id;},cancel:id=>frames.delete(id)});
  const tick=(time:number)=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(time));};
  tick(PHONE_SCROLL_DURATION/4);expect(write).toHaveBeenLastCalledWith(from+(to-from)*.0625);tick(PHONE_SCROLL_DURATION/2);expect(write).toHaveBeenLastCalledWith((from+to)/2);tick(PHONE_SCROLL_DURATION);expect(write).toHaveBeenLastCalledWith(to);expect(frames.size).toBe(0);
 }
 expect(scrollEase(.25)).toBeCloseTo(1-scrollEase(.75));
});
it('取消旧动画不会取消新方向的返回动画',()=>{
 const frames=new Map<number,(time:number)=>void>();let id=0;const write=vi.fn();const driver={position:()=>100,write,now:()=>0,request:(fn:(time:number)=>void)=>{frames.set(++id,fn);return id;},cancel:(id:number)=>frames.delete(id)};
 const cancelOld=animatePhoneScroll(800,driver);animatePhoneScroll(0,driver);cancelOld();expect(frames.size).toBe(1);[...frames.values()][0](PHONE_SCROLL_DURATION);expect(write).toHaveBeenLastCalledWith(0);
});
