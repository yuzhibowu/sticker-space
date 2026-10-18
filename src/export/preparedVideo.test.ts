import {expect,it,vi,afterEach} from 'vitest';
import {prepareVideoFrames,recordingFrameDelay,PREPARED_VIDEO_LIMIT} from './preparedVideo';
afterEach(()=>vi.unstubAllGlobals());
it('绘制耗时已经算在帧间隔里，不会每帧再额外等待33ms',()=>{
 const start=1000,fps=30;
 expect(recordingFrameDelay(start,1,fps,1012)).toBeCloseTo(1000/30-12);
 expect(recordingFrameDelay(start,2,fps,1050)).toBeCloseTo(1000*2/30-50);
 expect(recordingFrameDelay(start,3,fps,1120)).toBe(0);
 expect(recordingFrameDelay(start,240,fps,8990)).toBe(10);
});
it('在实时录制之前离线准备全部画面，时间点精确且使用压缩帧',async()=>{
 const drawAtTime=vi.fn(),types:string[]=[],progress=vi.fn();
 const canvas={toBlob:(callback:(blob:Blob)=>void,type:string)=>{types.push(type);callback(new Blob(['jpeg']));}} as HTMLCanvasElement;
 const frames=await prepareVideoFrames({canvas,drawAtTime},60,30,new AbortController().signal,progress);
 expect(frames).toHaveLength(60);expect(drawAtTime).toHaveBeenNthCalledWith(1,0);expect(drawAtTime).toHaveBeenLastCalledWith(59/30);expect(types.every(type=>type==='image/png')).toBe(true);
});
it('准备阶段可以取消，且有压缩缓存上限',async()=>{
 const controller=new AbortController(),drawAtTime=vi.fn(()=>controller.abort());
 const canvas={toBlob:(callback:(blob:Blob)=>void)=>callback(new Blob(['jpeg']))} as HTMLCanvasElement;
 await expect(prepareVideoFrames({canvas,drawAtTime},60,30,controller.signal,vi.fn())).rejects.toMatchObject({name:'AbortError'});expect(drawAtTime).toHaveBeenCalledOnce();
 const big={toBlob:(callback:(blob:Blob)=>void)=>callback({size:PREPARED_VIDEO_LIMIT+1} as Blob)} as HTMLCanvasElement;
 await expect(prepareVideoFrames({canvas:big,drawAtTime:vi.fn()},60,30,new AbortController().signal,vi.fn())).rejects.toThrow('缩短时长');
});
it('无损帧过大时才按剩余缓存退回高质量JPEG，缓存始终有界',async()=>{
 const calls:{type:string;quality:number|undefined}[]=[];
 const canvas={toBlob:(callback:(blob:Blob)=>void,type:string,quality?:number)=>{calls.push({type,quality});callback({type,size:type==='image/png'?100*1024*1024:5*1024*1024} as Blob);}} as HTMLCanvasElement;
 const frames=await prepareVideoFrames({canvas,drawAtTime:vi.fn()},2,30,new AbortController().signal,vi.fn());
 expect(calls).toEqual([{type:'image/png',quality:undefined},{type:'image/jpeg',quality:.995},{type:'image/png',quality:undefined}]);
 expect(frames.reduce((sum,frame)=>sum+frame.size,0)).toBeLessThanOrEqual(PREPARED_VIDEO_LIMIT);
});
