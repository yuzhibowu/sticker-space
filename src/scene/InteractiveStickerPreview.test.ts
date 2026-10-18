import * as THREE from 'three';
import {describe,expect,it,vi} from 'vitest';
import {InteractiveStickerPreview} from './InteractiveStickerPreview';
import {PreviewGeometryCache} from './PreviewGeometryCache';
import {makeStickerGeometry} from '../core/geometry';
import {POLE,type StickerData} from '../core/types';
const sticker:StickerData={id:'a',surfaceId:POLE.id,assetId:'png',position:[0,0,POLE.radius],normal:[0,0,1],rotation:[0,0,0],scale:[.6,.4],method:'conform',order:0,placedAt:0};
function setup(){
 const frames=new Map<number,()=>void>();let id=0;
 const mesh=new THREE.Mesh(makeStickerGeometry(sticker,POLE)),invalidate=vi.fn(),cache=new PreviewGeometryCache();
 const preview=new InteractiveStickerPreview(()=>mesh,invalidate,callback=>{frames.set(++id,callback);return id;},id=>frames.delete(id));
 const frame=()=>{const run=[...frames.values()];frames.clear();run.forEach(fn=>fn());};return {preview,mesh,invalidate,cache,frame,frames};
}
describe('手机滑块即时预览',()=>{
 it('一帧内100次输入只处理最后一次，不排队生成100张精细网格',()=>{
  const {preview,mesh,invalidate,frame,frames}=setup(),base=mesh.geometry;
  for(let i=0;i<100;i++)preview.update({...sticker,scale:[.6+i/100,.4]},POLE);
  expect(frames.size).toBe(1);expect(mesh.geometry).toBe(base);frame();expect(invalidate).toHaveBeenCalledOnce();
  const last=makeStickerGeometry({...sticker,scale:[1.59,.4]},POLE,'interactive');expect(mesh.geometry.attributes.position.array).toEqual(last.attributes.position.array);last.dispose();preview.cancel();base.dispose();
 });
 it('松手立即提交最后值，并复用同一精细网格供Canvas提交，不回闪旧值',()=>{
  const {preview,mesh,cache,frame,frames}=setup(),base=mesh.geometry,edited={...sticker,scale:[1.2,.8] as [number,number]};
  preview.update(edited,POLE);frame();const lightweight=mesh.geometry,dispose=vi.spyOn(lightweight,'dispose');
  const final={...edited,scale:[1.4,.8] as [number,number]};preview.update(final,POLE);preview.finish(final,POLE,cache);
  expect(frames.size).toBe(0);expect(mesh.geometry).toBe(cache.sticker(final,POLE));expect(dispose).toHaveBeenCalledOnce();expect(mesh.geometry).not.toBe(base);preview.cancel();expect(mesh.geometry).toBe(cache.sticker(final,POLE));cache.dispose();base.dispose();
 });
 it('取消时恢复原网格并清除待处理输入，模型数据与撤销记录不用跟着拖动更新',()=>{
  const {preview,mesh,frame,frames}=setup(),base=mesh.geometry;preview.update({...sticker,scale:[1.2,.8]},POLE);frame();const dispose=vi.spyOn(mesh.geometry,'dispose');
  preview.update({...sticker,scale:[1.6,.8]},POLE);preview.cancel();expect(frames.size).toBe(0);expect(mesh.geometry).toBe(base);expect(dispose).toHaveBeenCalledOnce();base.dispose();
 });
 it('轻量预览保持相同UV范围和曲面位置，正式网格仍用原精度',()=>{
  const data={...sticker,scale:[1.8,1.2] as [number,number]},full=makeStickerGeometry(data,POLE),fast=makeStickerGeometry(data,POLE,'interactive');
  expect(fast.attributes.position.count).toBeLessThan(full.attributes.position.count/4);expect(fast.boundingBox!.min.y).toBeCloseTo(full.boundingBox!.min.y,5);expect(fast.boundingBox!.max.y).toBeCloseTo(full.boundingBox!.max.y,5);
  for(const geometry of [fast,full]){const uv=geometry.attributes.uv;expect(uv.getX(0)).toBe(0);expect(uv.getY(0)).toBe(0);expect(uv.getX(uv.count-1)).toBe(1);expect(uv.getY(uv.count-1)).toBe(1);geometry.dispose();}
 });
});
