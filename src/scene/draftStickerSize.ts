import type {PerspectiveCamera,Vector3} from 'three';
/** Screen pixels per world metre on the same reference depth as the visible model. */
export function draftStickerPixelScale(camera:PerspectiveCamera,point:Vector3,height:number){
 const depth=Math.max(.1,-point.clone().applyMatrix4(camera.matrixWorldInverse).z);
 return height*camera.zoom/(2*depth*Math.tan(camera.fov*Math.PI/360));
}
