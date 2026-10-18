import {describe,it,expect} from 'vitest';
import {DEFAULT_MOTION,motionPlan,parseMotion} from './motion';
import type {StickerData} from './types';
const stickers=[{id:'b',order:1,placedAt:999},{id:'a',order:0,placedAt:234}] as StickerData[];
describe('完整贴纸动画',()=>{
 it('默认右旋，左右方向在同一时刻互为相反角度',()=>{const right=motionPlan(stickers,{...DEFAULT_MOTION,direction:'right'}),left=motionPlan(stickers,{...DEFAULT_MOTION,direction:'left'});expect(right.at(1).angle).toBeGreaterThan(0);expect(right.at(1).angle).toBeCloseTo(-left.at(1).angle);});
 it('忽略编辑时的时间戳，按指定顺序拍入并完成一圈和定格',()=>{
  const plan=motionPlan(stickers,{...DEFAULT_MOTION,mode:'sequence',direction:'left',heroAngle:45,order:['b','a']});
  expect(plan.ordered.map(s=>s.id)).toEqual(['b','a']);expect(plan.pose('b',0).visible).toBe(false);
  expect(plan.pose('b',.55).complete).toBe(false);expect(plan.pose('a',.55).visible).toBe(false);
  expect(plan.pose('a',plan.ready).complete).toBe(true);expect(plan.at(plan.turnEnd).angle).toBeCloseTo(-2*Math.PI);
  expect(plan.at(plan.duration).angle).toBeCloseTo(-2*Math.PI+Math.PI/4);expect(plan.at(plan.duration-1/24).phase).toBe('最终定格');
 });
 it('空场景和删除或新增贴纸仍有完整时长，不重复或者漏掉贴纸',()=>{const plan=motionPlan(stickers,{...DEFAULT_MOTION,order:['deleted','a']});expect(plan.ordered.map(s=>s.id)).toEqual(['a','b']);expect(motionPlan([]).duration).toBeGreaterThanOrEqual(7);});
 it('旋转立即匀速开始，并在贴纸逐张出现时持续旋转，可任意跳到同一时刻',()=>{const plan=motionPlan(stickers,{...DEFAULT_MOTION,direction:'left'});const middle=(plan.turnStart+plan.turnEnd)/2;expect(plan.at(middle).angle).toBeCloseTo(-Math.PI);expect(plan.at(middle)).toEqual(plan.at(middle));expect(plan.turnStart).toBe(0);expect(plan.at(.01).angle).toBeCloseTo(-2*Math.PI*.01/plan.turnEnd);expect(plan.at(.55).angle).toBeLessThan(0);});
 it('旧工程不强制添加动画，拒绝损坏参数',()=>{expect(parseMotion(undefined)).toBeUndefined();expect(()=>parseMotion({...DEFAULT_MOTION,interval:0})).toThrow();expect(()=>parseMotion({...DEFAULT_MOTION,order:['a','a']})).toThrow();});
});

it('旋转默认开启，关闭后保留贴入时间轴但不改变角度',()=>{expect(parseMotion({...DEFAULT_MOTION,enabled:undefined})?.enabled).toBe(true);const plan=motionPlan(stickers,{...DEFAULT_MOTION,enabled:false,heroAngle:45});for(const t of [0,1,3,plan.duration])expect(plan.at(t).angle).toBe(0);expect(plan.pose('a',plan.ready).complete).toBe(true);expect(()=>parseMotion({...DEFAULT_MOTION,enabled:'false'})).toThrow();});
