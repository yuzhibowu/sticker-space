import type {PerspectiveCamera} from 'three';
// A fixed spatial pattern, at one time instant: no frame-history ghosting or moving-letter blur.
export const STABLE_SUBPIXEL_OFFSETS=[[-.25,-.25],[.25,-.25],[-.25,.25],[.25,.25]] as const;
export function withStableSubpixelSampling(camera:PerspectiveCamera,width:number,height:number,draw:(index:number,count:number)=>void){
 const view=camera.view?{...camera.view}:null,aspect=camera.aspect;
 try{
  STABLE_SUBPIXEL_OFFSETS.forEach(([x,y],index)=>{
   camera.setViewOffset(width,height,x,y,width,height);draw(index,STABLE_SUBPIXEL_OFFSETS.length);
  });
 }finally{
  if(view?.enabled)camera.setViewOffset(view.fullWidth,view.fullHeight,view.offsetX,view.offsetY,view.width,view.height);
  else camera.clearViewOffset();
  camera.aspect=aspect;camera.updateProjectionMatrix();
 }
}
