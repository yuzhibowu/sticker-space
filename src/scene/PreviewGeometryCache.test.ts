import {expect,it,vi} from 'vitest';
import {PreviewGeometryCache} from './PreviewGeometryCache';
import {POLE,type StickerSceneData,type StickerData} from '../core/types';
const sticker:StickerData={id:'a',surfaceId:POLE.id,assetId:'png',position:[0,0,.56],normal:[0,0,1],rotation:[0,0,0],scale:[.6,.4],method:'conform',order:0,placedAt:0};
const scene:StickerSceneData={version:1,surface:POLE,assets:[],stickers:[sticker]};
it('keeps inactive model buffers reusable and only frees replaced/deleted buffers after commit',()=>{
  const cache=new PreviewGeometryCache(),body=cache.surface(POLE),paper=cache.sticker(sticker,POLE);
  const bodyDispose=vi.spyOn(body,'dispose'),paperDispose=vi.spyOn(paper,'dispose');
  const otherPole={...POLE,id:'second'};
  cache.prune({...scene,surface:otherPole,stickers:[],otherModels:[{surface:POLE,stickers:[sticker]}]});
  expect(cache.surface(POLE)).toBe(body);expect(cache.sticker(sticker,POLE)).toBe(paper);
  expect(bodyDispose).not.toHaveBeenCalled();expect(paperDispose).not.toHaveBeenCalled();
  const moved={...sticker,position:[0,.5,.56] as [number,number,number]};
  const replacement=cache.sticker(moved,POLE);expect(replacement).not.toBe(paper);expect(paperDispose).not.toHaveBeenCalled();
  cache.prune({...scene,stickers:[moved]});expect(paperDispose).toHaveBeenCalledTimes(1);
  const replacementDispose=vi.spyOn(replacement,'dispose');
  cache.prune({...scene,stickers:[]});expect(replacementDispose).toHaveBeenCalledTimes(1);
  cache.dispose();expect(bodyDispose).toHaveBeenCalledTimes(1);
  cache.dispose();expect(bodyDispose).toHaveBeenCalledTimes(1);
});
it('invalidates the cached shape when the pole length changes without reusing stale buffers',()=>{
  const cache=new PreviewGeometryCache(),before=cache.surface(POLE),paper=cache.sticker(sticker,POLE);
  const extended={...POLE,height:7,poleUpper:4.3,poleLower:2.7};
  expect(cache.surface(extended)).not.toBe(before);expect(cache.sticker(sticker,extended)).not.toBe(paper);
  cache.surface(extended).computeBoundingBox();expect(cache.surface(extended).boundingBox!.max.y).toBeCloseTo(4.3);
  cache.prune({...scene,surface:extended});cache.dispose();
});
