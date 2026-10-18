import {expect,it} from 'vitest';
import {historyReducer} from './StickerManager';
import {parseProject} from './project';
import {POLE,DAVID,type StickerSceneData} from './types';
const scene:StickerSceneData={version:1,surface:POLE,assets:[{id:"a",name:"test",image:"data:image/png;base64,iVBORw0KGgoAAA==",width:1,height:1}],stickers:[]};
it('groups slider changes into one undo and remembers each model tilt',()=>{
 let state=historyReducer(scene,{type:'model-tilt',angle:20,group:'tilt'});
 state=historyReducer(state,{type:'model-tilt',angle:40,group:'tilt'});
 expect(state.past).toHaveLength(1);expect(historyReducer(state,{type:'undo'}).present.modelTilt).toBeUndefined();
 state=historyReducer(state,{type:'surface',surface:DAVID});expect(state.present.modelTilt).toBeUndefined();
 state=historyReducer(state,{type:'model-tilt',angle:-90});state=historyReducer(state,{type:'surface',surface:POLE});
 expect(state.present.modelTilt).toBe(40);
 const parsed=parseProject(state.present);expect(parsed.modelTilt).toBe(40);expect(parsed.otherModels?.[0].modelTilt).toBe(-90);
});
it('accepts old projects and rejects invalid tilt values',()=>{
 expect(parseProject(scene).modelTilt).toBeUndefined();
 for(const modelTilt of [NaN,Infinity,-91,91,'30'])expect(()=>parseProject({...scene,modelTilt})).toThrow();
});
