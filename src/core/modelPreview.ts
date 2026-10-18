import {originalModelColor} from './modelColor';
import type {StickerSceneData,SurfaceData} from './types';
/** Model-only preview shares the current/saved appearance without attached stickers. */
export function modelPreviewScene(scene:StickerSceneData,surface:SurfaceData):StickerSceneData{
 const work=[scene,...(scene.otherModels??[])].find(work=>work.surface.id===surface.id);
 return {version:1,assets:[],stickers:[],surface:work?.surface??surface,modelColor:work?.modelColor??originalModelColor(surface),floating:work?.floating,modelTilt:work?.modelTilt,lighting:work?.lighting};
}
