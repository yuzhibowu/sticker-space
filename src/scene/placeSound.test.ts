import {beforeEach,expect,it,vi} from 'vitest';
const audio=vi.hoisted(()=>{
 const sources:any[]=[];
 const context={state:'suspended',currentTime:10,resume:vi.fn(async()=>{context.state='running';}),decodeAudioData:vi.fn(async()=>({duration:.34})),createGain:vi.fn(()=>({gain:{value:1},connect:vi.fn(),disconnect:vi.fn()})),destination:{},createBufferSource:vi.fn(()=>{const source={buffer:null,connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null};sources.push(source);return source;})};
 return {context,sources};
});
vi.mock('../vendor/sticker-forge/peel-audio',()=>({getSharedAudioContext:()=>audio.context}));
beforeEach(()=>{vi.restoreAllMocks();vi.stubGlobal('fetch',vi.fn(async()=>new Response(new Uint8Array([1,2,3]))));vi.spyOn(performance,'now').mockReturnValue(1000);});
it('preloads once, resumes in the gesture, and schedules one voice after the sticker lands',async()=>{
 const {preparePlaceSound,playPlaceSound}=await import('./placeSound');
 await preparePlaceSound();await preparePlaceSound();expect(fetch).toHaveBeenCalledTimes(1);
 playPlaceSound();expect(audio.context.resume).toHaveBeenCalledTimes(1);
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 expect(audio.sources).toHaveLength(1);expect(audio.sources[0].start).toHaveBeenCalledWith(10.16);
 audio.sources[0].onended();expect(audio.sources[0].disconnect).toHaveBeenCalledTimes(1);
 vi.unstubAllGlobals();
});
