import {describe,expect,it} from 'vitest';
import {isPhoneDevice,phoneStickerTarget} from './phoneControls';
import {transformSticker} from './editing';
import {historyReducer} from './StickerManager';
import {POLE,type StickerData,type StickerSceneData} from './types';
const sticker=(id:string,assetId='a'):StickerData=>({id,assetId,surfaceId:POLE.id,position:[0,0,POLE.radius],normal:[0,0,1],rotation:[0,0,0],scale:[.6,.6],order:0,placedAt:0,method:'conform'});
describe('手机专属调节杆',()=>{
 it('识别手机及新旧iPad，不把桌面电脑窄窗口当触控设备',()=>{
  expect(isPhoneDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(true);
  expect(isPhoneDevice('Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36')).toBe(true);
  expect(isPhoneDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/130 Safari/537.36',false)).toBe(false);
  expect(isPhoneDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130',false)).toBe(false);
  expect(isPhoneDevice('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)')).toBe(true);
  expect(isPhoneDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/26 Safari/605.1.15',false,5)).toBe(true);
  expect(isPhoneDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/26 Safari/605.1.15',false,0)).toBe(false);
 });
 it('贴模式每次只改最后添加的贴纸，下一次贴上后自动切到新贴纸',()=>{
  const first=sticker('first'),last=sticker('last','b');let scene:StickerSceneData={version:1,surface:POLE,assets:[],stickers:[first,last]};
  const target=phoneStickerTarget(scene.stickers,'place','first')!;expect(target).toBe(last);
  let history=historyReducer(scene,{type:'update',sticker:transformSticker(target,POLE,{width:.9}),group:'last:mobile-size'});scene=history.present;
  expect(scene.stickers[0]).toBe(first);expect(scene.stickers[1].scale[0]).toBeCloseTo(.9);
  history=historyReducer(history,{type:'place',sticker:sticker('newest')});expect(phoneStickerTarget(history.present.stickers,'place','first')?.id).toBe('newest');
 });
 it('没有已贴贴纸时调整待贴素材；撕模式调整所选贴纸；删除最后一张后回到上一张',()=>{
  const first=sticker('first'),last=sticker('last');expect(phoneStickerTarget([],'place',null)).toBeUndefined();
  expect(phoneStickerTarget([first,last],'edit','first')).toBe(first);expect(phoneStickerTarget([first,last],'view','first')).toBeUndefined();
  const history=historyReducer({version:1,surface:POLE,assets:[],stickers:[first,last]},{type:'remove',id:'last'});expect(phoneStickerTarget(history.present.stickers,'place',null)).toBe(first);
 });
});

it('实况快捷指令引导只识别 iPhone 和 iPad，Mac 和 Android 不显示',async()=>{
 const {isAppleTouchDevice}=await import('./phoneControls');
 expect(isAppleTouchDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X)',5)).toBe(true);
 expect(isAppleTouchDevice('Mozilla/5.0 (iPad; CPU OS 27_0 like Mac OS X)',5)).toBe(true);
 expect(isAppleTouchDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',5)).toBe(true);
 expect(isAppleTouchDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',0)).toBe(false);
 expect(isAppleTouchDevice('Mozilla/5.0 (Linux; Android 16; Mobile)',5)).toBe(false);
});

it('安卓实况入口按设备识别，覆盖一加8T及安卓平板，排除Mac和iPhone',async()=>{const {isAndroidDevice}=await import('./phoneControls');expect(isAndroidDevice('Mozilla/5.0 (Linux; Android 14; KB2000) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36')).toBe(true);expect(isAndroidDevice('Mozilla/5.0 (Linux; Android 14; Tablet)')).toBe(true);expect(isAndroidDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(false);expect(isAndroidDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X)')).toBe(false);});
