import {it,expect} from 'vitest';
import {historyReducer} from './StickerManager';
import {POLE,DAVID,type StickerSceneData,type StickerData} from './types';
const asset=(id:string)=>({id,name:id,image:'data:image/png;base64,iVBORw0KGgo',width:1,height:1});
const sticker=(id:string,assetId:string):StickerData=>({id,assetId,surfaceId:POLE.id,position:[0,0,.56],normal:[0,0,1],rotation:[0,0,0],scale:[1,1],method:'conform',order:0,placedAt:0});
const scene:StickerSceneData={version:1,surface:POLE,assets:[asset('demo-lab'),asset('user-1')],stickers:[sticker('keep','demo-lab'),sticker('remove','user-1')],otherModels:[{surface:DAVID,stickers:[sticker('other','user-1')]}]};
it('protects default stickers from removal',()=>{
 expect(historyReducer(scene,{type:'remove-asset',id:'demo-lab'}).present).toBe(scene);
});
it('removes uploaded resources and all placements in one undoable step',()=>{
 const result=historyReducer(scene,{type:'remove-asset',id:'user-1'});
 expect(result.present.assets.map(a=>a.id)).toEqual(['demo-lab']);
 expect(result.present.stickers.map(s=>s.id)).toEqual(['keep']);
 expect(result.present.otherModels![0].stickers).toHaveLength(0);
 expect(historyReducer(result,{type:'undo'}).present).toEqual(scene);
});
