import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {POLE,type StickerSceneData} from '../core/types';
import {DEFAULT_VIDEO} from './videoSettings';
const fake=vi.hoisted(()=>({draw:vi.fn(),paint:vi.fn(),closeBitmap:vi.fn(),dispose:vi.fn(),render:vi.fn(),canEncode:vi.fn(),samples:[] as number[][],cancel:vi.fn(),frame:vi.fn(),trackStop:vi.fn()}));
vi.mock('./video',()=>({createVideoRenderer:vi.fn(async()=>({canvas:{toBlob:(callback:(blob:Blob)=>void)=>callback(new Blob(['jpeg'])),getContext:()=>({drawImage:fake.paint}),captureStream:()=>({getTracks:()=>[{stop:fake.trackStop}],getVideoTracks:()=>[{requestFrame:vi.fn()}]})},drawAtTime:fake.draw,dispose:fake.dispose,render:fake.render}))}));
vi.mock('mediabunny',()=>({
 canEncodeVideo:fake.canEncode,
 BufferTarget:class{buffer:ArrayBuffer|null=null;},Mp4OutputFormat:class{},
 Output:class{state='pending';target:{buffer:ArrayBuffer|null};constructor(options:{target:{buffer:ArrayBuffer|null}}){this.target=options.target;}addVideoTrack(){}async start(){this.state='started';}async finalize(){this.target.buffer=new ArrayBuffer(32);this.state='finalized';}async cancel(){this.state='canceled';fake.cancel();}},
 CanvasSource:class{async add(...args:number[]){fake.samples.push(args);fake.frame();}},
}));
import {exportMobileVideo,mobileVideoBackground,mp4RecordingType} from './mobileVideo';
import {createVideoRenderer} from './video';
const scene:StickerSceneData={version:1,surface:POLE,assets:[],stickers:[]};
const settings={...DEFAULT_VIDEO,aspect:'3:4' as const,duration:2};
beforeEach(()=>{vi.clearAllMocks();fake.samples.length=0;fake.frame.mockReset();fake.canEncode.mockResolvedValue(true);vi.stubGlobal('VideoEncoder',class{});vi.stubGlobal('createImageBitmap',vi.fn(async()=>({close:fake.closeBitmap})));vi.stubGlobal('fetch',vi.fn(async()=>({ok:true})));vi.stubGlobal('document',Object.assign(new EventTarget(),{hidden:false}));});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('逐帧编码完整时长、严格时间戳，不读取PNG帧；结束后释放渲染器',async()=>{
 const result=await exportMobileVideo(scene,settings,'transparent',new AbortController().signal,vi.fn());
 expect(fake.samples).toHaveLength(60);expect(fake.samples[0]).toEqual([0,1/30]);expect(fake.samples[59]).toEqual([59/30,1/30]);
 expect(createVideoRenderer).toHaveBeenCalledWith(scene,settings,2,{background:'#ffffff',stableSampling:true,boundedEncoding:true});expect(fake.render).not.toHaveBeenCalled();expect(fake.dispose).toHaveBeenCalledOnce();
 expect(result.blob.type).toBe('video/mp4');expect(result.name).toContain('720x960');URL.revokeObjectURL(result.url);
});
it('取消导出会释放编码器与WebGL渲染器，不返回半成品',async()=>{
 const controller=new AbortController();fake.frame.mockImplementationOnce(()=>{}).mockImplementationOnce(()=>controller.abort());
 await expect(exportMobileVideo(scene,settings,'#123456',controller.signal,vi.fn())).rejects.toMatchObject({name:'AbortError'});
 expect(fake.samples).toHaveLength(2);expect(fake.cancel).toHaveBeenCalled();expect(fake.dispose).toHaveBeenCalledOnce();
});
it('后台切换中止导出并给出保持前台的提示',async()=>{
 fake.frame.mockImplementationOnce(()=>{Object.assign(document,{hidden:true});document.dispatchEvent(new Event('visibilitychange'));});
 await expect(exportMobileVideo(scene,settings,'#fff',new AbortController().signal,vi.fn())).rejects.toThrow('保持页面在前台');expect(fake.dispose).toHaveBeenCalledOnce();
});
it('不能编码MP4时给出浏览器提示，不连接助手或创建渲染器',async()=>{
 fake.canEncode.mockResolvedValue(false);vi.stubGlobal('MediaRecorder',undefined);
 await expect(exportMobileVideo(scene,settings,'#fff',new AbortController().signal,vi.fn())).rejects.toThrow('无法编码 MP4');expect(createVideoRenderer).not.toHaveBeenCalled();
});
it('Safari备用路径只选择MP4录制并停止所有媒体轨道',async()=>{
 vi.useFakeTimers({toFake:['setTimeout','clearTimeout','performance']});fake.canEncode.mockResolvedValue(false);
 let started=0,recordedDuration=0;fake.paint.mockImplementation(()=>vi.advanceTimersByTime(8));
 vi.stubGlobal('MediaRecorder',class{
  static isTypeSupported(type:string){return type==='video/mp4';}state='inactive';ondataavailable?:(event:{data:Blob})=>void;onstop?:()=>void;onerror?:()=>void;
  start(){this.state='recording';started=performance.now();expect(fake.dispose).toHaveBeenCalledOnce();}stop(){recordedDuration=performance.now()-started;this.state='inactive';this.ondataavailable?.({data:new Blob(['mp4-data'])});this.onstop?.();}
 });
 const pending=exportMobileVideo(scene,{...settings,aspect:'1:1'},'#112233',new AbortController().signal,vi.fn());await vi.waitFor(()=>expect(createVideoRenderer).toHaveBeenCalled());await vi.advanceTimersByTimeAsync(2200);const result=await pending;
 expect(recordedDuration).toBeCloseTo(2000,0);expect(fake.closeBitmap).toHaveBeenCalledTimes(60);expect(fake.trackStop).toHaveBeenCalledOnce();expect(fake.samples).toHaveLength(0);expect(result.name).toContain('720x720');expect(fake.dispose).toHaveBeenCalledOnce();expect(fake.draw).toHaveBeenCalledTimes(61);URL.revokeObjectURL(result.url);
});
it('普通视频合成白色透明底，保留已选背景；拒绝WebM冒充MP4',()=>{
 expect(mobileVideoBackground('transparent')).toBe('#ffffff');expect(mobileVideoBackground('#123456')).toBe('#123456');
 expect(mp4RecordingType(type=>type.startsWith('video/webm'))).toBeUndefined();expect(mp4RecordingType(type=>type==='video/mp4')).toBe('video/mp4');
});

it('4K60按原始分辨率与完整帧数编码，不受整批PNG预算限制',async()=>{
 const result=await exportMobileVideo(scene,{...settings,resolution:2160,fps:60,duration:8,aspect:'16:9'},'#fff',new AbortController().signal,vi.fn());
 expect(fake.canEncode).toHaveBeenCalledWith('avc',expect.objectContaining({width:3840,height:2160,frameRate:60}));
 expect(fake.samples).toHaveLength(480);expect(fake.samples[479]).toEqual([479/60,1/60]);expect(result.name).toContain('3840x2160');URL.revokeObjectURL(result.url);
});
