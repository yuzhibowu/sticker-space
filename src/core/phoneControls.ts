import type {StickerData} from './types';

export function isIPadDevice(userAgent:string,maxTouchPoints=0){return /iPad/i.test(userAgent)||(/Macintosh/i.test(userAgent)&&maxTouchPoints>1);}

export function isAndroidDevice(userAgent:string){return /Android/i.test(userAgent);}

export function isAppleTouchDevice(userAgent:string,maxTouchPoints=0){return /iPhone|iPod/i.test(userAgent)||isIPadDevice(userAgent,maxTouchPoints);}

/** Phone/iPad touch mode is independent of the browser window's width. */
export function isPhoneDevice(userAgent:string,mobileHint?:boolean,maxTouchPoints=0){
 return mobileHint===true||isIPadDevice(userAgent,maxTouchPoints)||/iPhone|iPod|iPad|Android[^\n]*Mobile|Windows Phone/i.test(userAgent);
}
export function phoneStickerTarget(stickers:StickerData[],mode:'place'|'edit'|'view',selectedId:string|null){
 if(mode==='edit')return stickers.find(sticker=>sticker.id===selectedId);
 if(mode==='place')return stickers.at(-1);
 return undefined;
}
