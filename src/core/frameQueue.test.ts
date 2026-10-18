import {it,expect} from 'vitest';
import {createFrameQueue} from './frameQueue';
it('一帧内的多个移动只更新最新位置，松手前立即保存最终位置',()=>{
  let scheduled:(()=>void)|null=null,cancelled=0,calls:number[]=[];
  const queue=createFrameQueue(run=>{scheduled=run;return 1;},()=>{cancelled++;scheduled=null;});
  queue.push(()=>calls.push(1));queue.push(()=>calls.push(2));queue.push(()=>calls.push(3));expect(calls).toEqual([]);scheduled!();expect(calls).toEqual([3]);
  queue.push(()=>calls.push(4));queue.push(()=>calls.push(5));queue.flush();expect(calls).toEqual([3,5]);expect(cancelled).toBe(1);expect(scheduled).toBeNull();
  queue.push(()=>calls.push(6));queue.cancel();expect(calls).toEqual([3,5]);expect(scheduled).toBeNull();
});
