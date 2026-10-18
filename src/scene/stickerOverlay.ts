import * as THREE from 'three';
import type {StickerData} from '../core/types';
/** Project a 100px DOM image through the same camera and plane as the 3D preview. */
export function stickerOverlayTransform(data:StickerData,camera:THREE.Camera,root:THREE.Matrix4,rect:{left:number;top:number;width:number;height:number},scale:number){
 const position=new THREE.Vector3(...data.position).addScaledVector(new THREE.Vector3(...data.normal),.025);
 const model=new THREE.Matrix4().compose(position,new THREE.Quaternion().setFromEuler(new THREE.Euler(...data.rotation)),new THREE.Vector3(data.scale[0]*scale/100,-data.scale[1]*scale/100,1));
 model.multiply(new THREE.Matrix4().makeTranslation(-50,-50,0));
 const clip=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(root).multiply(model).elements;
 const css=Array.from({length:16},(_,i)=>{const col=Math.floor(i/4)*4;switch(i%4){case 0:return clip[col]*rect.width/2+clip[col+3]*(rect.left+rect.width/2);case 1:return -clip[col+1]*rect.height/2+clip[col+3]*(rect.top+rect.height/2);case 2:return clip[col+2];default:return clip[col+3];}});
 const divisor=css[15];if(divisor<=0)return null;
 return `matrix3d(${css.map(value=>value/divisor).join(',')})`;
}
