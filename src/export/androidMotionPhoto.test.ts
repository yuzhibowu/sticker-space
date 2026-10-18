import {it,expect} from 'vitest';
import {packAndroidMotionPhoto} from './androidMotionPhoto';
const jpeg=new Uint8Array([255,216,255,217]),video=new Uint8Array([0,0,0,16,102,116,121,112,105,115,111,109,0,0,0,0]);
it('通用格式在 JPEG 后保持视频字节不变，XMP 长度准确',()=>{
 const out=packAndroidMotionPhoto(jpeg,video,'google');expect(out.slice(-video.length)).toEqual(video);expect(out.slice(-video.length-2,-video.length)).toEqual(new Uint8Array([255,217]));
 const text=new TextDecoder().decode(out);expect(text).toContain('Item:Length="16"');expect(text).toContain('GCamera:MotionPhoto="1"');expect(text).not.toContain('OpCamera:');
});
it('Oplus 写入 UserComment、MPF 图像长度及 O-Live 标签，末尾不污染视频',()=>{
 const out=packAndroidMotionPhoto(jpeg,video,'oplus');const text=new TextDecoder().decode(out);expect(text).toContain('Oplus_8388608');expect(text).toContain('OpCamera:VideoLength="16"');expect(text).toContain('OpCamera:OLivePhotoVersion="2"');
 const mpf=out.findIndex((_,i)=>out[i]===77&&out[i+1]===80&&out[i+2]===70&&out[i+3]===0),view=new DataView(out.buffer);expect(mpf).toBeGreaterThan(0);expect(view.getUint32(mpf+4+54)).toBe(out.length-video.length);expect(view.getUint32(mpf+4+30)).toBe(1);expect(out.slice(-16)).toEqual(video);
});
it('拒绝损坏的输入、已有元数据及无效参数',()=>{
 expect(()=>packAndroidMotionPhoto(new Uint8Array(),video)).toThrow();expect(()=>packAndroidMotionPhoto(jpeg,new Uint8Array())).toThrow();expect(()=>packAndroidMotionPhoto(jpeg,video,'oplus',-1)).toThrow();expect(()=>packAndroidMotionPhoto(new Uint8Array([255,216,255,225,0,2,255,217]),video)).toThrow();
});
