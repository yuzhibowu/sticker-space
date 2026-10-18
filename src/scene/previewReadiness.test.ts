import {expect,it} from 'vitest';
import {waitForPreview} from './previewReadiness';
it('lets navigation continue when an old saved sticker never mounts',async()=>{
 let time=0,frames=0;
 expect(await waitForPreview(()=>false,async()=>{time+=16;frames++;},()=>false,48,()=>time)).toBe(false);
 expect(frames).toBe(3);
});
it('waits for GPU readiness and stops when the selected model changes',async()=>{
 let frames=0;
 expect(await waitForPreview(()=>frames===2,async()=>{frames++;},()=>false,100,()=>frames*16)).toBe(true);
 frames=0;
 expect(await waitForPreview(()=>false,async()=>{frames++;},()=>frames===1,100,()=>frames*16)).toBe(false);
});
