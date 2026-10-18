import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {TouchNavigation} from './touchNavigation';
function setup(sticker=false){
 const callbacks={enabled:()=>true,onStart:vi.fn(()=>({sticker})),onCancelSticker:vi.fn(),onOrbit:vi.fn(),onTap:vi.fn(),onPinch:vi.fn(),onEnd:vi.fn(),requestFrame:(fn:()=>void)=>setTimeout(fn,16) as unknown as number,cancelFrame:(id:number)=>clearTimeout(id)};return {touch:new TouchNavigation(callbacks),callbacks};
}
beforeEach(()=>vi.useFakeTimers());afterEach(()=>vi.useRealTimers());
describe('手机触控操作',()=>{
 it('拖动空白区域旋转，轻点仍能贴纸',()=>{
  const {touch,callbacks}=setup();expect(touch.down(1,{x:100,y:100})).toBe(false);expect(touch.end(1)).toBe(true);
  touch.down(2,{x:100,y:100});touch.move(2,{x:140,y:120});expect(callbacks.onOrbit).toHaveBeenCalledWith(40,20);expect(touch.end(2)).toBe(true);expect(touch.suppressClick).toBe(true);
 });
 it('第二指取消撕纸；双指改为模型缩放，剩余单指不能继续旋转或撕纸',()=>{
  const {touch,callbacks}=setup(true);expect(touch.down(1,{x:100,y:100})).toBe(false);expect(touch.move(1,{x:105,y:100})).toBe(false);
  expect(touch.down(2,{x:200,y:100})).toBe(true);touch.move(1,{x:75,y:100});touch.move(2,{x:225,y:100});vi.advanceTimersByTime(16);expect(callbacks.onPinch).toHaveBeenCalledWith(150/95,{x:150,y:100,distance:150});
  touch.end(2);expect(touch.move(1,{x:140,y:100})).toBe(true);expect(callbacks.onOrbit).not.toHaveBeenCalled();expect(callbacks.onCancelSticker).toHaveBeenCalledOnce();touch.end(1);expect(touch.active).toBe(false);
 });
 it('取消会话后下一次轻点恢复；空闲取消不会提交历史',()=>{
  const {touch,callbacks}=setup();touch.cancel();expect(callbacks.onEnd).not.toHaveBeenCalled();touch.down(1,{x:100,y:100});touch.cancel();expect(touch.active).toBe(false);touch.down(2,{x:100,y:100});expect(touch.suppressClick).toBe(false);expect(touch.end(2)).toBe(true);
 });
 it.each([false,true])('在预览/贴模式和撕模式都用双指缩放模型，收拢可缩小（撕纸=%s）',sticker=>{
  const {touch,callbacks}=setup(sticker);touch.down(1,{x:100,y:100});touch.down(2,{x:200,y:100});touch.move(1,{x:120,y:100});touch.move(2,{x:180,y:100});vi.advanceTimersByTime(16);
  expect(callbacks.onPinch).toHaveBeenCalledWith(.6,{x:150,y:100,distance:60});expect(callbacks.onOrbit).not.toHaveBeenCalled();touch.end(1);touch.end(2);expect(callbacks.onEnd).toHaveBeenCalledOnce();
 });
 it('双指平移不改贴纸大小角度，也不误缩放；取消后待处理捏合失效',()=>{
  const {touch,callbacks}=setup();touch.down(1,{x:100,y:100});touch.down(2,{x:200,y:100});touch.move(1,{x:130,y:120});touch.move(2,{x:230,y:120});vi.advanceTimersByTime(16);expect(callbacks.onPinch).not.toHaveBeenCalled();
  touch.move(2,{x:260,y:120});touch.cancel();vi.advanceTimersByTime(16);expect(callbacks.onPinch).not.toHaveBeenCalled();
 });

 it('抬手立即贴上，允许轻微手指抖动，取消与双指操作不误贴',()=>{
  const {touch,callbacks}=setup();touch.down(1,{x:100,y:100});touch.move(1,{x:105,y:103});touch.end(1,true,{x:106,y:104});expect(callbacks.onTap).toHaveBeenCalledWith({x:106,y:104});expect(callbacks.onTap).toHaveBeenCalledOnce();expect(touch.suppressClick).toBe(true);
  touch.down(2,{x:100,y:100});touch.end(2,false);expect(callbacks.onTap).toHaveBeenCalledOnce();
  touch.down(3,{x:100,y:100});touch.down(4,{x:200,y:100});touch.end(3);touch.end(4);expect(callbacks.onTap).toHaveBeenCalledOnce();
 });

});
