import type {BufferGeometry} from 'three';
import {makeStickerGeometry,surfaceGeometry} from '../core/geometry';
import type {StickerData,StickerSceneData,SurfaceData} from '../core/types';

/** Preview-only ownership; exports always build independent geometry. */
export class PreviewGeometryCache {
  private surfaces=new Map<string,{source:SurfaceData;geometry:BufferGeometry}>();
  private stickers=new Map<string,{source:StickerData;surface:SurfaceData;geometry:BufferGeometry}>();
  private retired:BufferGeometry[]=[];
  surface(source:SurfaceData) {
    const previous=this.surfaces.get(source.id);
    if(previous?.source===source||(previous?.source.kind==='custom'&&source.kind==='custom'&&previous.source.source===source.source))return previous.geometry;
    const geometry=surfaceGeometry(source);
    if(previous)this.retired.push(previous.geometry);
    this.surfaces.set(source.id,{source,geometry});return geometry;
  }
  sticker(source:StickerData,surface:SurfaceData) {
    const previous=this.stickers.get(source.id);
    if(previous?.source===source&&previous.surface===surface)return previous.geometry;
    const geometry=makeStickerGeometry(source,surface);
    if(previous)this.retired.push(previous.geometry);
    this.stickers.set(source.id,{source,surface,geometry});return geometry;
  }
  /** Run after commit: removed/replaced meshes no longer reference retired buffers. */
  prune(scene:StickerSceneData) {
    const works=[scene,...(scene.otherModels??[])];
    const surfaceIds=new Set(works.map(w=>w.surface.id)),stickerIds=new Set(works.flatMap(w=>w.stickers.map(s=>s.id)));
    for(const [id,entry] of this.surfaces)if(!surfaceIds.has(id)){this.retired.push(entry.geometry);this.surfaces.delete(id);}
    for(const [id,entry] of this.stickers)if(!stickerIds.has(id)){this.retired.push(entry.geometry);this.stickers.delete(id);}
    this.retired.forEach(g=>g.dispose());this.retired=[];
  }
  dispose() {
    new Set([...this.retired,...[...this.surfaces.values(),...this.stickers.values()].map(e=>e.geometry)]).forEach(g=>g.dispose());
    this.surfaces.clear();this.stickers.clear();this.retired=[];
  }
}
