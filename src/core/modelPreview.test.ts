import {expect,it} from 'vitest';
import {modelPreviewScene} from './modelPreview';
import {POLE,ROAD_SIGN,type StickerSceneData} from './types';
const scene:StickerSceneData={version:1,surface:POLE,assets:[],stickers:[],modelColor:{saturation:.8,brightness:1.1,contrast:1.2},otherModels:[{surface:ROAD_SIGN,stickers:[],modelColor:{saturation:.6,brightness:.7,contrast:.9}}]};
it('preview uses current and saved edits before defaults',()=>{
 expect(modelPreviewScene(scene,POLE).modelColor).toEqual(scene.modelColor);
 expect(modelPreviewScene(scene,ROAD_SIGN).modelColor).toEqual(scene.otherModels![0].modelColor);
});
it('unvisited models preview their tuned defaults without adding stickers',()=>{
 const surface={id:'custom-example-safety-helmet',kind:'custom' as const,height:5.4,name:'安全帽',source:'/models/safety-helmet.glb'};
 expect(modelPreviewScene(scene,surface)).toMatchObject({modelColor:{saturation:1.42,brightness:.61,contrast:.96},stickers:[],assets:[]});
});
