import {expect,it} from 'vitest';
import * as THREE from 'three';
import {modelHit} from './modelSurface';
import {stickerHitIsVisible,sortStickerIntersections} from './stickerVisibility';
import {POLE} from './types';
it('blocks the back sheet from the front, then allows it only after the camera turns around',()=>{
  const frontRay=new THREE.Ray(new THREE.Vector3(0,0,8),new THREE.Vector3(0,0,-1));
  const frontPoint=new THREE.Vector3(0,0,POLE.radius+.002),backPoint=new THREE.Vector3(0,0,-POLE.radius-.002);
  expect(stickerHitIsVisible(frontRay,frontPoint,modelHit(frontRay,POLE))).toBe(true);
  expect(stickerHitIsVisible(frontRay,backPoint,modelHit(frontRay,POLE))).toBe(false);
  const backRay=new THREE.Ray(new THREE.Vector3(0,0,-8),new THREE.Vector3(0,0,1));
  expect(stickerHitIsVisible(backRay,backPoint,modelHit(backRay,POLE))).toBe(true);
  expect(stickerHitIsVisible(backRay,frontPoint,modelHit(backRay,POLE))).toBe(false);
});
it('still lets a visibly overhanging paper edge be grabbed where there is no model occluder',()=>{
  const ray=new THREE.Ray(new THREE.Vector3(1,0,8),new THREE.Vector3(0,0,-1));
  expect(stickerHitIsVisible(ray,new THREE.Vector3(1,0,.5),null)).toBe(true);
});
it('grabs the visible top layer when independently wrapped surfaces cross in depth',()=>{
 const lower=new THREE.Object3D(),upper=new THREE.Object3D(),body=new THREE.Object3D();
 lower.name='sticker-lower';lower.renderOrder=1;upper.name='sticker-upper';upper.renderOrder=2;
 const hits=[{object:lower,distance:1,point:new THREE.Vector3()},{object:body,distance:1.1,point:new THREE.Vector3()},{object:upper,distance:1.0002,point:new THREE.Vector3()}];
 expect(sortStickerIntersections(hits).map(hit=>hit.object)).toEqual([upper,lower,body]);
 expect(hits[0].object).toBe(lower);
});
