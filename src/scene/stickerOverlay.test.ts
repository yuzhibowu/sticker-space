import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import type {StickerData} from '../core/types';
import {stickerOverlayTransform} from './stickerOverlay';
describe('carried sticker projection',()=>{
 it('matches the camera projection at each corner, including tilted paper and a shifted viewport',()=>{
  const camera=new THREE.PerspectiveCamera(40,1.5,.1,100);camera.position.set(0,0,5);camera.updateMatrixWorld();
  const data={position:[.5,.2,0],normal:[0,0,1],rotation:[.2,.4,.1],scale:[2,1]} as StickerData;
  const root=new THREE.Matrix4().makeRotationY(.15),rect={left:20,top:60,width:900,height:600};
  const transform=stickerOverlayTransform(data,camera,root,rect,.7)!;
  const matrix=new THREE.Matrix4().fromArray(transform.slice(9,-1).split(',').map(Number));
  expect(Math.abs(matrix.determinant())).toBeGreaterThan(1e-8);
  for(const [x,y] of [[0,0],[100,0],[0,100],[100,100]]){
   const actual=new THREE.Vector3(x,y,0).applyMatrix4(matrix);
   const expected=new THREE.Vector3((x-50)*2*.7/100,-(y-50)*.7/100,0).applyEuler(new THREE.Euler(...data.rotation)).add(new THREE.Vector3(.5,.2,.025)).applyMatrix4(root).project(camera);
   expect(actual.x).toBeCloseTo(rect.left+(expected.x+1)*rect.width/2,6);
   expect(actual.y).toBeCloseTo(rect.top+(1-expected.y)*rect.height/2,6);
  }
 });
 it('keeps projected corners outside the canvas instead of clipping to its edge',()=>{
  const camera=new THREE.PerspectiveCamera(40,1,.1,100);camera.position.z=5;camera.updateMatrixWorld();
  const data={position:[1.7,0,0],normal:[0,0,1],rotation:[0,0,0],scale:[2,2]} as StickerData;
  const matrix=new THREE.Matrix4().fromArray(stickerOverlayTransform(data,camera,new THREE.Matrix4(),{left:0,top:0,width:500,height:500},1)!.slice(9,-1).split(',').map(Number));
  expect(new THREE.Vector3(100,50,0).applyMatrix4(matrix).x).toBeGreaterThan(500);
 });
});
