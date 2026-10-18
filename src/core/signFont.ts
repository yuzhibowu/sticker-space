import {gunzipSync,strFromU8} from 'fflate';
import {FontLoader,type Font} from 'three/examples/jsm/loaders/FontLoader.js';
import {customSignFont} from './customSignFont';
import type {SurfaceData} from './types';
let font:Font | null=null, pending:Promise<void> | null=null;
export function installSignFont(bytes:Uint8Array) {
  const raw=bytes[0]===31 && bytes[1]===139 ? gunzipSync(bytes) : bytes;
  font=new FontLoader().parse(JSON.parse(strFromU8(raw)));
}
export async function loadSignFont() {
  if(font) return;
  return pending ??= (async()=>{
    const response=await fetch('/fonts/sign-noto-sc-bold.json.gz');
    if(!response.ok) throw new Error('路牌字体加载失败，请重试。');
    installSignFont(new Uint8Array(await response.arrayBuffer()));
  })().catch(error=>{pending=null;throw error;});
}
export function signFont(surface?:Extract<SurfaceData,{kind:'sign'}>) { if(!font) throw new Error('路牌字体尚未加载'); return surface?.font ? customSignFont(surface.font,surface.text,font) : font; }
export function normalizedSignText(text:string) { return Array.from(text.replace(/\r\n?/g,'\n')).slice(0,80).join('').split('\n').slice(0,3).join('\n'); }
