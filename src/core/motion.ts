import type {MotionSettings,StickerData} from './types';
import {SLAP_DURATION,stickerPoseAtTime} from './timeline';
export const DEFAULT_MOTION:MotionSettings={mode:'turntable',enabled:true,direction:'right',intro:.5,interval:.35,turnDuration:6,hold:1,heroAngle:0};
const smooth=(t:number)=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};
/** 只依赖绝对时间与工程数据；网页掉帧不影响离线视频中的顺序与时长。 */
export function motionPlan(stickers:StickerData[],settings:MotionSettings=DEFAULT_MOTION) {
  const saved=new Map((settings.order??[]).map((id,i)=>[id,i]));
  const ordered=stickers.map((s,i)=>({s,i})).sort((a,b)=>(saved.get(a.s.id)??1e6+a.s.order)-(saved.get(b.s.id)??1e6+b.s.order)||a.i-b.i).map(({s})=>s);
  const starts=new Map(ordered.map((s,i)=>[s.id,settings.intro+i*settings.interval]));
  const ready=settings.intro+(ordered.length?(ordered.length-1)*settings.interval+SLAP_DURATION:0);
  const turnStart=0,turnEnd=Math.max(ready,settings.turnDuration),heroEnd=turnEnd+(settings.heroAngle===0?0:.8);
  const duration=heroEnd+settings.hold;
  return {ordered,starts,ready,turnStart,turnEnd,heroEnd,duration,at(time:number){
    const angle=time<=turnStart?0:time<turnEnd?-Math.PI*2*(time-turnStart)/(turnEnd-turnStart):-Math.PI*2+settings.heroAngle*Math.PI/180*smooth((time-turnEnd)/Math.max(.001,heroEnd-turnEnd));
    return {angle:settings.enabled===false?0:(settings.direction??'right')==='right'?-angle:angle,phase:time<settings.intro?'空模型':time<ready?'贴纸拍入':time<turnStart?'贴合停留':time<turnEnd?'旋转一圈':time<heroEnd?'调整定格角度':'最终定格'};
  },pose(id:string,time:number){return stickerPoseAtTime(time,starts.get(id)??Infinity);}};
}
export function parseMotion(value:unknown):MotionSettings|undefined {
  if(value===undefined)return undefined;
  const m=value as MotionSettings;
  if(!m||!['turntable','sequence'].includes(m.mode)||!Number.isFinite(m.intro)||m.intro<0||m.intro>10||!Number.isFinite(m.interval)||m.interval<.16||m.interval>3||!Number.isFinite(m.turnDuration)||m.turnDuration<1||m.turnDuration>30||!Number.isFinite(m.hold)||m.hold<.25||m.hold>10||!Number.isFinite(m.heroAngle)||Math.abs(m.heroAngle)>180||m.order!==undefined&&(!Array.isArray(m.order)||m.order.length>2000||new Set(m.order).size!==m.order.length||m.order.some(id=>typeof id!=='string'||id.length>100)))throw new Error('动画参数无效，当前作品未修改。');
  if(m.enabled!==undefined&&typeof m.enabled!=='boolean')throw new Error('旋转开关无效');
  if(m.direction!==undefined&&!['left','right'].includes(m.direction))throw new Error('旋转方向无效');
  return {mode:m.mode,enabled:m.enabled??true,direction:m.direction??'right',intro:m.intro,interval:m.interval,turnDuration:m.turnDuration,hold:m.hold,heroAngle:m.heroAngle,...(m.order?{order:[...m.order]}:{})};
}
