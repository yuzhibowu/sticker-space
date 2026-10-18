import * as THREE from 'three';
import {MODEL_EXAMPLES} from './modelExamples';
import {modelGeometry} from './modelSurface';
import {defaultModelView} from './poleDimensions';
import type {CameraView,SurfaceData} from './types';

const AUTO_FRAME_IDS=new Set(MODEL_EXAMPLES.slice(1).map(surface=>surface.id));
export const isAutoFrameExample=(surface:SurfaceData)=>AUTO_FRAME_IDS.has(surface.id);
export const isLegacyExampleView=(view:CameraView|undefined)=>Boolean(view
 && Math.abs(view.position[0])<1e-6&&Math.abs(view.position[1]-.18)<1e-6&&Math.abs(view.position[2]-8.8)<1e-6
 && Math.abs(view.target[0])+Math.abs(view.target[1])+Math.abs(view.target[2])<1e-6&&(view.zoom??1)===1);

/** Fit the five scanned examples against both viewport axes, including their depth. */
export function framedModelView(surface:SurfaceData,aspect:number,fov=39):CameraView{
 if(!isAutoFrameExample(surface)||!Number.isFinite(aspect)||aspect<=0)return defaultModelView(surface);
 const geometry=modelGeometry(surface);geometry.computeBoundingBox();
 const size=geometry.boundingBox!.getSize(new THREE.Vector3()),tangent=Math.tan(THREE.MathUtils.degToRad(fov/2));
 const fit=Math.max(size.y/(2*tangent),size.x/(2*tangent*aspect));
 const distance=size.z/2+fit*1.22;
 return {position:[0,.18,distance],target:[0,0,0],zoom:1};
}
