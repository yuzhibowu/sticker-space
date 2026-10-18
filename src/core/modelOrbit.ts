import * as THREE from 'three';
import {poleDimensions} from './poleDimensions';
import {modelGeometry} from './modelSurface';
import type {SurfaceData} from './types';

/** Sign artwork and a panned/zoomed view never redefine the physical model pivot. */
export function modelOrbitPivot(surface:SurfaceData,geometry?:THREE.BufferGeometry){
  if(surface.kind==='cylinder'||surface.kind==='sign')return new THREE.Vector3(0,poleDimensions(surface).center,0);
  const source=geometry??modelGeometry(surface);if(!source.boundingBox)source.computeBoundingBox();
  return source.boundingBox!.getCenter(new THREE.Vector3());
}

/** Orbit the complete camera pose around the model, preserving the user's off-center framing.
 * Moving both position and look target avoids snapping a panned view back to the screen center. */
export function rotateViewAroundModel(camera:THREE.PerspectiveCamera,target:THREE.Vector3,pivot:THREE.Vector3,yaw:number,pitch:number){
  const offset=camera.position.clone().sub(pivot),radius=offset.length();if(radius<1e-8)return;
  const turn=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);
  offset.applyQuaternion(turn);
  const phi=Math.acos(THREE.MathUtils.clamp(offset.y/radius,-1,1));
  const clampedPitch=THREE.MathUtils.clamp(phi+pitch,.2,Math.PI-.2)-phi;
  const right=new THREE.Vector3(offset.z,0,-offset.x).normalize();
  const tilt=new THREE.Quaternion().setFromAxisAngle(right,clampedPitch),rotation=tilt.multiply(turn);
  camera.position.sub(pivot).applyQuaternion(rotation).add(pivot);
  target.sub(pivot).applyQuaternion(rotation).add(pivot);
  camera.lookAt(target);camera.updateMatrixWorld();
}

/** Z tilt is outside the Y turn: the entire turntable axis leans with the model. */
export function setModelYaw(object:THREE.Object3D,angle:number,pivot:THREE.Vector3,tiltDegrees=0){
  const tilt=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-THREE.MathUtils.degToRad(tiltDegrees));
  object.quaternion.copy(tilt).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle));
  object.position.copy(pivot).sub(pivot.clone().applyQuaternion(object.quaternion));
}
export function modelSpinAxis(tiltDegrees=0){return new THREE.Vector3(0,1,0).applyAxisAngle(new THREE.Vector3(0,0,1),-THREE.MathUtils.degToRad(tiltDegrees));}
