import {expect,it} from 'vitest';
import * as THREE from 'three';
import {modelOrbitPivot,rotateViewAroundModel,setModelYaw} from './modelOrbit';
import {POLE,ROAD_SIGN,DAVID} from './types';
import {panView,zoomView} from './viewNavigation';
it('keeps the sign pivot on its pole regardless of its artwork or pole lengths',()=>{
  expect(modelOrbitPivot(ROAD_SIGN).toArray()).toEqual([0,0,0]);
  expect(modelOrbitPivot({...ROAD_SIGN,poleUpper:6,poleLower:2}).toArray()).toEqual([0,2,0]);
  expect(modelOrbitPivot(POLE).toArray()).toEqual([0,0,0]);
});
it('uses the whole statue bounds rather than a head or pointer-focus target',()=>{
  const geometry=new THREE.BoxGeometry(2,5.4,1);geometry.translate(.15,0,-.05);
  expect(modelOrbitPivot(DAVID,geometry).y).toBeCloseTo(0);expect(modelOrbitPivot(DAVID,geometry).x).toBeCloseTo(.15);
  geometry.dispose();
});
it('orbits around the model after pan and focused zoom without snapping the horizontal framing',()=>{
  const camera=new THREE.PerspectiveCamera(39,16/9,.1,100),target=new THREE.Vector3(),pivot=new THREE.Vector3();
  camera.position.set(0,.18,8.8);camera.lookAt(target);camera.updateMatrixWorld();
  panView(camera,target,140,90,720);
  const focus=new THREE.Vector3(.2,2.3,.4),ndc=focus.clone().project(camera);
  zoomView(camera,target,2,new THREE.Vector2(ndc.x,ndc.y),focus);
  const before=pivot.clone().project(camera),distance=camera.position.distanceTo(pivot),targetDistance=target.distanceTo(pivot);
  rotateViewAroundModel(camera,target,pivot,Math.PI/2,0);
  const after=pivot.clone().project(camera);
  expect(after.x).toBeCloseTo(before.x,8);expect(after.y).toBeCloseTo(before.y,8);
  expect(camera.position.distanceTo(pivot)).toBeCloseTo(distance);expect(target.distanceTo(pivot)).toBeCloseTo(targetDistance);
  rotateViewAroundModel(camera,target,pivot,0,.3);
  expect(camera.position.distanceTo(pivot)).toBeCloseTo(distance);expect(target.distanceTo(pivot)).toBeCloseTo(targetDistance);
});
it('automatic yaw keeps the physical pivot fixed as well',()=>{
  const root=new THREE.Group(),pivot=new THREE.Vector3(.2,.4,-.1);
  setModelYaw(root,1.3,pivot);root.updateMatrixWorld(true);
  expect(pivot.clone().applyMatrix4(root.matrixWorld).distanceTo(pivot)).toBeLessThan(1e-8);
});
it('leans the turntable axis around Z while keeping the pivot and tilt fixed through a full turn',()=>{
 const root=new THREE.Group(),pivot=new THREE.Vector3(.2,.4,-.1),tilt=Math.PI/3;
 const expectedAxis=new THREE.Vector3(Math.sin(tilt),Math.cos(tilt),0);
 for(const yaw of [0,.5,Math.PI,Math.PI*2]){
  setModelYaw(root,yaw,pivot,60);root.updateMatrixWorld(true);
  expect(pivot.clone().applyMatrix4(root.matrixWorld).distanceTo(pivot)).toBeLessThan(1e-8);
  expect(new THREE.Vector3(0,1,0).applyQuaternion(root.quaternion).distanceTo(expectedAxis)).toBeLessThan(1e-8);
 }
});
