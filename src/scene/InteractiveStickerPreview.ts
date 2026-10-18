import type {BufferGeometry,Mesh} from 'three';
import {makeStickerGeometry} from '../core/geometry';
import type {StickerData,SurfaceData} from '../core/types';
import type {PreviewGeometryCache} from './PreviewGeometryCache';

/** Drag feedback bypasses React's page render and keeps only the latest input per frame. */
export class InteractiveStickerPreview{
 private pending:{sticker:StickerData;surface:SurfaceData}|null=null;
 private frame:number|null=null;
 private live:{mesh:Mesh;base:BufferGeometry;geometry:BufferGeometry}|null=null;
 constructor(private find:(id:string)=>Mesh|undefined,private invalidate:()=>void,private request:(fn:()=>void)=>number,private cancelFrame:(id:number)=>void){}
 update(sticker:StickerData,surface:SurfaceData){
  this.pending={sticker,surface};
  if(this.frame===null)this.frame=this.request(()=>{this.frame=null;this.flush();});
 }
 private flush(){
  const pending=this.pending;this.pending=null;if(!pending)return;
  const mesh=this.find(pending.sticker.id);if(!mesh)return;
  if(this.live&&this.live.mesh!==mesh)this.restore();
  const geometry=makeStickerGeometry(pending.sticker,pending.surface,'interactive');
  const previous=this.live,base=previous?.base??mesh.geometry;
  mesh.geometry=geometry;this.live={mesh,base,geometry};previous?.geometry.dispose();this.invalidate();
 }
 finish(sticker:StickerData,surface:SurfaceData,cache:PreviewGeometryCache){
  this.clearFrame();const mesh=this.find(sticker.id);
  if(mesh){if(this.live&&this.live.mesh!==mesh)this.restore();mesh.geometry=cache.sticker(sticker,surface);this.live?.geometry.dispose();this.live=null;this.invalidate();}
  else this.restore();
 }
 cancel(){this.clearFrame();this.restore();}
 private clearFrame(){if(this.frame!==null)this.cancelFrame(this.frame);this.frame=null;this.pending=null;}
 private restore(){if(!this.live)return;this.live.mesh.geometry=this.live.base;this.live.geometry.dispose();this.live=null;this.invalidate();}
}
