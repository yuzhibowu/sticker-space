import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { gunzipSync } from 'fflate';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { decodeModel, installModelGeometry, modelGeometry, modelAnchor, modelHit } from './modelSurface';
import { makeStickerGeometry, orientation } from './geometry';
import { DAVID, POLE, type StickerData, type StickerSceneData } from './types';
import { historyReducer } from './StickerManager';
import { parseProject } from './project';
import { transformSticker } from './editing';
const bytes=new Uint8Array(readFileSync('public/models/david.mesh.gz'));
beforeAll(()=>installModelGeometry(decodeModel(bytes)));
const sticker=(x:number,y:number,back:boolean,width=.5):StickerData=> {
  const hit=modelAnchor(x,y,back)!;
  if (!hit) throw new Error('Missing real scan anchor');
  return {id:'body',assetId:'png',surfaceId:DAVID.id,...hit,rotation:orientation(hit.normal,-.1).toArray().slice(0,3) as [number,number,number],scale:[width,width*.48],method:'conform',order:0,placedAt:0};
};
describe('真实大卫扫描曲面',()=>{
  it('gzip 与服务器已解压的传输均可读取，完整全身且网格不可因副本释放而丢失',()=>{
    const raw=decodeModel(gunzipSync(bytes)); raw.computeBoundingBox();
    expect(raw.boundingBox!.max.y-raw.boundingBox!.min.y).toBeCloseTo(5.4,4);
    expect(raw.index!.count/3).toBeGreaterThan(200000); expect(raw.index!.count/3).toBeLessThan(300000);
    const copy=modelGeometry().clone(); copy.dispose(); expect(modelAnchor(-.4,.1,true)).not.toBeNull();
  });
  it.each([[-.4,.1,true],[-.25,.5,false],[.26,-.14,false]] as const)('位置 %s,%s 背面 %s：贴纸曲面跟随实际人体，不浮起或投到反面', (x,y,back)=>{
    const data=sticker(x,y,back), start=performance.now(), g=makeStickerGeometry(data,DAVID);
    expect(performance.now()-start).toBeLessThan(1500);
    const p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv');
    expect(p.count).toBeGreaterThan(30);
    const tree=(modelGeometry() as THREE.BufferGeometry & {boundsTree:MeshBVH}).boundsTree;
    const centerNormal=new THREE.Vector3(...data.normal); let variation=0;
    for(let i=0;i<p.count;i+=Math.max(1,Math.floor(p.count/50))) {
      const normal=new THREE.Vector3().fromBufferAttribute(n,i), point=new THREE.Vector3().fromBufferAttribute(p,i);
      expect(normal.length()).toBeCloseTo(1,4);
      variation=Math.max(variation,normal.distanceTo(centerNormal));
      const contact=point.addScaledVector(normal,-.0006), near=tree.closestPointToPoint(contact);
      if(!g.userData.supportedPaper)expect(near!.distance).toBeLessThan(.00003);
      else expect(Number.isFinite(near!.distance)).toBe(true);
      expect(uv.getX(i)).toBeGreaterThanOrEqual(-.00001); expect(uv.getX(i)).toBeLessThanOrEqual(1.00001);
      expect(uv.getY(i)).toBeGreaterThanOrEqual(-.00001); expect(uv.getY(i)).toBeLessThanOrEqual(1.00001);
      expect(normal.dot(centerNormal)).toBeGreaterThan(0);
    }
    expect(variation).toBeGreaterThan(.03); g.dispose();
  });
  it('定位总是选择射线遇到的第一层皮肤，而非穿透到另一侧',()=>{
    const mesh=new THREE.Mesh(modelGeometry()); mesh.updateMatrixWorld();
    for(const [x,y] of [[0,0],[-.8,-.3],[-.2,1]]) for(const back of [false,true]) {
      const caster=new THREE.Raycaster(new THREE.Vector3(x,y,back ? -5 : 5),new THREE.Vector3(0,0,back ? 1 : -1));
      const baseline=caster.intersectObject(mesh)[0], hit=modelHit(caster.ray);
      if (!baseline) { expect(hit).toBeNull(); continue; }
      expect(new THREE.Vector3(...hit!.position).distanceTo(baseline.point)).toBeLessThan(1e-6);
    }
    (mesh.material as THREE.Material).dispose();
  });
  it('相邻且不相连的手臂不接受躯干贴纸的第二份投影',()=>{
    const saved=modelGeometry(), body=new THREE.SphereGeometry(.6,64,32), limb=new THREE.SphereGeometry(.14,32,16); limb.translate(.65,0,.65);
    const combined=mergeGeometries([body,limb]);
    try {
      installModelGeometry(combined);
      const data:StickerData={id:'patch',surfaceId:DAVID.id,assetId:'png',position:[0,0,.6],normal:[0,0,1],rotation:[0,0,0],scale:[1.8,.8],method:'conform',order:0,placedAt:0};
      const g=makeStickerGeometry(data,DAVID), p=g.attributes.position;
      expect(p.count).toBeGreaterThan(0);
      // 包覆可延伸到躯干侧面，但每个顶点仍必须位于躯干球面，不能跳到旁边独立手臂。
      for(let i=0;i<p.count;i++)expect(new THREE.Vector3().fromBufferAttribute(p,i).length()).toBeCloseTo(.6006,2);
      g.dispose();
    } finally { installModelGeometry(saved); body.dispose(); limb.dispose(); combined.dispose(); }
  });
  it('竖直法线朝向有效，改尺寸和角度保留真实表面位置',()=>{
    for(const normal of [[0,1,0],[0,-1,0]] as [number,number,number][]) {
      const q=new THREE.Quaternion().setFromEuler(orientation(normal,.4));
      expect(new THREE.Vector3(0,0,1).applyQuaternion(q).distanceTo(new THREE.Vector3(...normal))).toBeLessThan(1e-6);
    }
    const data=sticker(-.4,.1,true), edited=transformSticker(data,DAVID,{width:.65,roll:.3});
    expect(edited.position).toEqual(data.position); expect(edited.normal).toEqual(data.normal);
    expect(makeStickerGeometry(edited,DAVID).attributes.position.count).toBeGreaterThan(0);
  });
});
describe('两模型作品保存',()=>{
  const asset={id:'png',name:'test',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',width:1,height:1};
  it('切换、撤销、工程往返保留两个模型的贴纸和各自镜头',()=>{
    const poleSticker:StickerData={...sticker(-.4,.1,true),id:'pole',surfaceId:POLE.id,position:[0,0,POLE.radius],normal:[0,0,1],rotation:[0,0,0]};
    const initial:StickerSceneData={version:1,surface:POLE,assets:[asset],stickers:[poleSticker],view:{position:[0,0,7],target:[0,0,0]}};
    let h=historyReducer(initial,{type:'surface',surface:DAVID});
    h=historyReducer(h,{type:'place',sticker:sticker(-.4,.1,true)});
    h=historyReducer(h,{type:'view',view:{position:[0,0,-4],target:[0,0,0]}});
    h=historyReducer(h,{type:'surface',surface:POLE});
    expect(h.present.stickers[0].id).toBe('pole'); expect(h.present.view!.position[2]).toBe(7);
    const loaded=parseProject(JSON.parse(JSON.stringify(h.present)));
    const switched=historyReducer(loaded,{type:'surface',surface:DAVID});
    expect(switched.present.stickers).toHaveLength(1); expect(switched.present.view!.position[2]).toBe(-4);
    const undo=historyReducer(switched,{type:'undo'}); expect(undo.present.surface.id).toBe(POLE.id); expect(undo.present.view!.position[2]).toBe(7);
    expect(()=>parseProject({...loaded,otherModels:[{...loaded.otherModels![0],surface:{...DAVID,modelId:'remote-url'}}]})).toThrow();
  });
});
