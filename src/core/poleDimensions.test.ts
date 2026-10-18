import {beforeAll,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {POLE,ROAD_SIGN,type StickerData,type StickerSceneData} from './types';
import {resizePole,poleDimensions,SIGN_PANEL_HALF_HEIGHT} from './poleDimensions';
import {roadSignParts,roadSignGeometry} from './roadSign';
import {installSignFont} from './signFont';
import {surfaceGeometry,makeStickerGeometry} from './geometry';
import {parseProject} from './project';
import {historyReducer} from './StickerManager';
beforeAll(()=>installSignFont(new Uint8Array(readFileSync('public/fonts/sign-noto-sc-bold.json.gz'))));
const initial:StickerSceneData={version:1,surface:ROAD_SIGN,assets:[{id:'png',name:'test',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',width:1,height:1}],stickers:[]};
it('路牌上下杆身可独立增长，真实三维边界变化而牌面及贴纸不移位',()=>{
  const top=resizePole(ROAD_SIGN,'upper',3.5),surface=resizePole(top,'lower',2);
  expect(poleDimensions(top).lower).toBe(2.7);expect(poleDimensions(surface).upper).toBeCloseTo(SIGN_PANEL_HALF_HEIGHT+3.5);
  const old=roadSignParts(ROAD_SIGN),parts=roadSignParts(surface as typeof ROAD_SIGN);
  for(const part of parts){part.geometry.computeBoundingBox();if(part.name==='SignMetalPole'){expect(part.geometry.boundingBox!.max.y).toBeCloseTo(5.43);expect(part.geometry.boundingBox!.min.y).toBeCloseTo(-3.93);}else expect(part.geometry.getAttribute('position').array).toEqual(old.find(p=>p.name===part.name)!.geometry.getAttribute('position').array);}
  const sticker:StickerData={id:'paper',surfaceId:ROAD_SIGN.id,assetId:'png',position:[.3,.5,.444],normal:[0,0,1],rotation:[0,0,0],scale:[.6,.4],method:'conform',order:0,placedAt:0};
  const before=makeStickerGeometry(sticker,ROAD_SIGN),after=makeStickerGeometry(sticker,surface);
  expect(after.getAttribute('uv').array).toEqual(before.getAttribute('uv').array);expect(after.getAttribute('position').array).toEqual(before.getAttribute('position').array);
  const data=parseProject({...initial,surface,stickers:[sticker]});expect(data.surface).toEqual(surface);expect(data.stickers[0]).toEqual(sticker);
  expect(roadSignGeometry(surface as typeof ROAD_SIGN).boundingBox!.max.y).toBeCloseTo(5.43);
  [...old,...parts].forEach(p=>p.geometry.dispose());before.dispose();after.dispose();
});
it('电线杆保持中心及贴纸坐标，缩短后边界约束、保存和撤销一致',()=>{
  const sticker:StickerData={id:'paper',surfaceId:POLE.id,assetId:'png',position:[0,2,.56],normal:[0,0,1],rotation:[0,0,0],scale:[.6,.4],method:'conform',order:0,placedAt:0};
  const data={...initial,surface:POLE,stickers:[sticker]};let state=historyReducer(data,{type:'pole-length',side:'upper',length:6});
  expect(state.present.stickers[0]).toBe(sticker);expect(state.present.surface.height).toBe(8.7);
  const g=surfaceGeometry(state.present.surface);g.computeBoundingBox();expect(g.boundingBox!.max.y).toBeCloseTo(6);expect(g.boundingBox!.min.y).toBeCloseTo(-2.7);g.dispose();
  expect(parseProject(state.present).surface).toEqual(state.present.surface);
  state=historyReducer(state,{type:'commit'});state=historyReducer(state,{type:'pole-length',side:'upper',length:1});
  expect(state.present.stickers[0].position[1]).toBeLessThan(1);expect(parseProject(state.present)).toBeTruthy();
  expect(historyReducer(state,{type:'undo'}).present.stickers[0]).toEqual(sticker);
  expect(()=>parseProject({...initial,surface:{...ROAD_SIGN,height:6,poleUpper:3,poleLower:2.7}})).toThrow();
});
it('重置镜头适应加长杆身，保持可保存的缩放值及路牌固定坐标',async()=>{
  const {defaultModelView}=await import('./poleDimensions'),{MIN_VIEW_ZOOM}=await import('./viewNavigation');
  const long=resizePole(resizePole(ROAD_SIGN,'upper',10),'lower',10),view=defaultModelView(long);
  expect(view.zoom).toBeGreaterThanOrEqual(MIN_VIEW_ZOOM);expect(Math.hypot(...view.position)).toBeLessThan(14);expect(view.target[1]).toBe(0);
  expect(parseProject({...initial,surface:long,view})).toBeTruthy();
  const asymmetric=resizePole(ROAD_SIGN,'upper',4),camera=defaultModelView(asymmetric,true);expect(camera.target[1]).toBe(poleDimensions(asymmetric).center);expect(camera.position[2]).toBeLessThan(0);
});
