import {expect,it} from 'vitest';
import * as THREE from 'three';
import {draftStickerPixelScale} from './draftStickerSize';
it('待贴预览使用与实际相机投影相同的尺寸，跟随缩放和模型距离',()=>{
 const camera=new THREE.PerspectiveCamera(39,.75,.1,100);camera.position.set(0,0,10);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const point=new THREE.Vector3(0,0,1),height=600,scale=draftStickerPixelScale(camera,point,height);
 const a=new THREE.Vector3(0,-.5,1).project(camera),b=new THREE.Vector3(0,.5,1).project(camera);expect(scale).toBeCloseTo((b.y-a.y)*height/2,8);
 camera.zoom=2;camera.updateProjectionMatrix();expect(draftStickerPixelScale(camera,point,height)).toBeCloseTo(scale*2,8);
 camera.position.z=19;camera.updateMatrixWorld();expect(draftStickerPixelScale(camera,point,height)).toBeCloseTo(scale,8);
});

it('围绕模型中心旋转时预览尺寸不变，推近镜头才会放大',()=>{
 const center=new THREE.Vector3(0,.3,0),camera=new THREE.PerspectiveCamera(39,.75,.1,100);
 const sizes=[0,.7,1.8,3.14].map(angle=>{
  camera.position.copy(center).add(new THREE.Vector3(Math.sin(angle)*10,0,Math.cos(angle)*10));camera.lookAt(center);camera.updateMatrixWorld();
  return draftStickerPixelScale(camera,center,600);
 });
 sizes.forEach(size=>expect(size).toBeCloseTo(sizes[0],8));
 camera.position.copy(center).add(new THREE.Vector3(0,0,5));camera.lookAt(center);camera.updateMatrixWorld();
 expect(draftStickerPixelScale(camera,center,600)).toBeCloseTo(sizes[0]*2,8);
});
