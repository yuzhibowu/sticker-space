import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {readFileSync} from 'node:fs';
import {decodeModel,installModelGeometry,modelAnchor,modelGeometry} from './modelSurface';
import {surfaceWrapGeometry} from './surfaceWrap';
import {supportedPaperGeometry} from './supportedPaper';
import {orientation} from './geometry';
import type {StickerData} from './types';
const data:StickerData={id:'tent',assetId:'png',surfaceId:'test',position:[0,0,.2],normal:[0,0,1],rotation:[0,0,0],scale:[1,.5],method:'conform',order:0,placedAt:0};
describe('凸起支撑纸面',()=>{
 it('凸起处整张纸连续且顶点紧贴起伏表面，两端回到基底',()=>{
  const source=new THREE.PlaneGeometry(2,2,100,100),p=source.getAttribute('position');
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,.2*Math.exp(-(x*x+y*y)/.005));}source.computeVertexNormals();(source as THREE.BufferGeometry&{boundsTree:MeshBVH}).boundsTree=new MeshBVH(source);
  const g=supportedPaperGeometry(data,source,60,30),v=g.getAttribute('position'),uv=g.getAttribute('uv');
  let top=0;
  for(let i=0;i<v.count;i++){top=Math.max(top,v.getZ(i));const near=(source as THREE.BufferGeometry&{boundsTree:MeshBVH}).boundsTree.closestPointToPoint(new THREE.Vector3().fromBufferAttribute(v,i));expect(near!.distance).toBeLessThan(.008);expect(v.getX(i)).toBeCloseTo(uv.getX(i)-.5,5);expect(v.getY(i)).toBeCloseTo((uv.getY(i)-.5)*.5,5);}
  expect(top).toBeGreaterThan(.2);
  // Triangle interior samples must remain outside the underlying bump.
  const index=g.index!,ray=new THREE.Ray(),tree=(source as THREE.BufferGeometry&{boundsTree:MeshBVH}).boundsTree;
  for(let i=0;i<index.count;i+=3){const point=new THREE.Vector3();for(let j=0;j<3;j++)point.add(new THREE.Vector3().fromBufferAttribute(v,index.getX(i+j)));point.divideScalar(3);ray.origin.set(point.x,point.y,1);ray.direction.set(0,0,-1);const hit=tree.raycastFirst(ray,THREE.DoubleSide)!;expect(point.z).toBeGreaterThanOrEqual(1-hit.distance-.00005);}
  expect(uv.getX(0)).toBe(0);expect(uv.getX(uv.count-1)).toBe(1);g.dispose();source.dispose();
 });
 it('真实大卫局部复杂凸起可自动改用连续支撑，不再保留炸裂网格',()=>{
  installModelGeometry(decodeModel(new Uint8Array(readFileSync('public/models/david.mesh.gz'))));let supported=0;
  for(const y of [-1.4,-1.2,-1,-.8,-.6,-.4,-.2,0])for(const x of [-.1,0,.1]){
   const hit=modelAnchor(x,y);if(!hit)continue;
   const sticker={...data,...hit,rotation:orientation(hit.normal,0).toArray().slice(0,3) as [number,number,number],scale:[1.2,.35] as [number,number]};
   const g=surfaceWrapGeometry(sticker,modelGeometry());if(g.userData.supportedPaper){supported++;const p=g.getAttribute('position');for(let i=0;i<p.count;i++)expect(Number.isFinite(p.getX(i))).toBe(true);}g.dispose();
  }
  // Include front and back hair anchors so dense curls exercise the protection as well.
  for(const back of [false,true])for(const x of [-.25,0,.25]){
   const hair=modelAnchor(x,2.05,back);if(!hair)continue;
   const paper=surfaceWrapGeometry({...data,...hair,rotation:orientation(hair.normal,0).toArray().slice(0,3) as [number,number,number],scale:[.95,.95]},modelGeometry());
   if(paper.userData.supportedPaper)supported++;
   const p=paper.getAttribute('position'),uv=paper.getAttribute('uv');
   if(paper.userData.supportedPaper){const inverse=new THREE.Matrix4().compose(new THREE.Vector3(...hair.position),new THREE.Quaternion().setFromEuler(orientation(hair.normal,0)),new THREE.Vector3(1,1,1)).invert();for(let i=0;i<p.count;i++){const local=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(inverse);expect(local.x).toBeCloseTo((uv.getX(i)-.5)*.95,4);expect(local.y).toBeCloseTo((uv.getY(i)-.5)*.95,4);}}
   paper.dispose();
  }
  expect(supported).toBeGreaterThan(0);
  const shoulder=modelAnchor(-.25,.5)!;
  const shoulderPaper=surfaceWrapGeometry({...data,...shoulder,rotation:orientation(shoulder.normal,-.1).toArray().slice(0,3) as [number,number,number],scale:[.5,.24]},modelGeometry());
  expect(shoulderPaper.userData.supportedPaper).toBe(true);shoulderPaper.dispose();
 });
});
