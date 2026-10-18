import * as THREE from 'three';
import type {FloatingSettings,SurfaceData} from './types';
import {modelGeometry} from './modelSurface';
import {setModelYaw} from './modelOrbit';
/** PNG微动画/dist/motion.js: exact full-cycle rise, tilt and phase constants. */
export const DEFAULT_FLOATING:Readonly<FloatingSettings>=Object.freeze({enabled:false,amount:1});
export function floatingPose(settings:FloatingSettings|undefined,time:number,period:number,radius:number){
 const amount=settings?.enabled?settings.amount:0,cycle=2*Math.PI*((time%period+period)%period)/period;
 return {y:-Math.cos(cycle)*.047*radius*amount,tiltX:Math.cos(2*cycle+.35)*.012*amount,tiltZ:-Math.sin(cycle+.7)*.014*amount};
}
export function floatingRotation(pose:ReturnType<typeof floatingPose>){return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),pose.tiltZ).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),pose.tiltX));}
export function floatingRadius(surface:SurfaceData){const geometry=modelGeometry(surface);if(!geometry.boundingSphere)geometry.computeBoundingSphere();return geometry.boundingSphere!.radius;}
export function applyModelMotion(object:THREE.Object3D,yaw:number,pivot:THREE.Vector3,tilt:number,floating:FloatingSettings|undefined,time:number,period:number,radius:number){
 setModelYaw(object,yaw,pivot,tilt);
 if(!floating?.enabled)return;
 const pose=floatingPose(floating,time,period,radius);
 object.quaternion.premultiply(floatingRotation(pose));
 object.position.copy(pivot).sub(pivot.clone().applyQuaternion(object.quaternion));object.position.y+=pose.y;
}
export function parseFloating(value:unknown):FloatingSettings|undefined{
 if(value===undefined)return;
 const settings=value as FloatingSettings;
 if(!settings||typeof settings.enabled!=='boolean'||!Number.isFinite(settings.amount)||settings.amount<0||settings.amount>3)throw new Error('漂浮参数无效。');
 return {enabled:settings.enabled,amount:settings.amount};
}
