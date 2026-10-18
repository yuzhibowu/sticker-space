import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {surfaceWrapGeometry} from './surfaceWrap';
import type {StickerData} from './types';
describe('完整曲面包覆',()=>{
 it('整张贴纸绕细手腕包到背面，UV四角仍完整且不离开皮肤',()=>{
  const source=new THREE.CylinderGeometry(.15,.15,2,128,32,true);(source as THREE.BufferGeometry&{boundsTree:MeshBVH}).boundsTree=new MeshBVH(source);
  const data:StickerData={id:'wrap',assetId:'png',surfaceId:'test',position:[0,0,.15],normal:[0,0,1],rotation:[0,0,0],scale:[.9,.4],method:'conform',order:0,placedAt:0};
  const g=surfaceWrapGeometry(data,source);expect(g.userData.supportedPaper).not.toBe(true);const p=g.getAttribute('position'),uv=g.getAttribute('uv');let minZ=1;
  for(let i=0;i<p.count;i++){minZ=Math.min(minZ,p.getZ(i));expect(Math.hypot(p.getX(i),p.getZ(i))).toBeCloseTo(.1506,3);}
  expect(minZ).toBeLessThan(-.13);expect(uv.getX(0)).toBe(0);expect(uv.getY(0)).toBe(0);expect(uv.getX(uv.count-1)).toBe(1);expect(uv.getY(uv.count-1)).toBe(1);g.dispose();source.dispose();
 });
 it('a collapsed scan face produces a complete finite sheet instead of crashing',()=>{
  const source=new THREE.BufferGeometry();
  source.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0,0,0,0,0,0, -1,-1,-.1,1,-1,-.1,0,1,-.1],3));
  source.setAttribute('normal',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1],3));source.setIndex([0,1,2,3,4,5]);
  (source as THREE.BufferGeometry&{boundsTree:MeshBVH}).boundsTree=new MeshBVH(source);
  const data:StickerData={id:'collapsed',assetId:'png',surfaceId:'scan',position:[0,0,0],normal:[0,0,1],rotation:[0,0,0],scale:[.3,.3],method:'conform',order:0,placedAt:0};
  const g=surfaceWrapGeometry(data,source),p=g.getAttribute('position'),uv=g.getAttribute('uv');
  expect(g.userData.supportedPaper).toBe(true);expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
  expect(uv.getX(0)).toBe(0);expect(uv.getY(0)).toBe(0);expect(uv.getX(uv.count-1)).toBe(1);expect(uv.getY(uv.count-1)).toBe(1);g.dispose();source.dispose();
 });

});
