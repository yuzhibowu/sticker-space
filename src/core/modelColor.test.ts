import {expect,it} from 'vitest';
import {parseModelColor,DEFAULT_MODEL_COLOR,originalModelColor} from './modelColor';
import {historyReducer} from './StickerManager';
import {parseProject} from './project';
import {POLE,DAVID,type StickerSceneData} from './types';
import {originalLighting,resolveLighting} from './modelLighting';
it('new bread bag starts at the screenshot settings and keeps manual edits across switches',()=>{
 const scene:StickerSceneData={version:1,surface:POLE,assets:[],stickers:[]};
 const bag={id:'custom-example-dalian-bread-bag',kind:'custom' as const,height:5.4,name:'大连面包节大浪包',source:'/models/dalian-bread-bag.glb'};
 let state=historyReducer(scene,{type:'surface',surface:bag});
 expect(state.present.modelColor).toEqual({saturation:1.44,brightness:1.31,contrast:1});
 expect(resolveLighting(undefined,bag)).toMatchObject({exposure:1,environmentIntensity:.98,keyLightIntensity:0,fillLightIntensity:.5,shadowIntensity:0,toneMapping:'aces'});
 state=historyReducer(state,{type:'model-color',modelColor:{saturation:1.5,brightness:1.2,contrast:1}});
 state=historyReducer(state,{type:'surface',surface:POLE});state=historyReducer(state,{type:'surface',surface:bag});
 expect(state.present.modelColor?.saturation).toBe(1.5);
});
it('color edits survive undo, model switches and portable project parsing',()=>{
 const scene:StickerSceneData={version:1,surface:POLE,assets:[{id:'a',name:'test',width:1,height:1,image:'data:image/png;base64,iVBORw0KGgoAAA=='}],stickers:[]};
 let state=historyReducer(scene,{type:'model-color',modelColor:{saturation:.8,brightness:1.1,contrast:1.2},group:'color'});
 state=historyReducer(state,{type:'model-color',modelColor:{saturation:.5,brightness:1.1,contrast:1.2},group:'color'});
 expect(state.past).toHaveLength(1);expect(historyReducer(state,{type:'undo'}).present.modelColor).toBeUndefined();
 state=historyReducer(state,{type:'surface',surface:DAVID});expect(state.present.modelColor).toBeUndefined();
 const restored=parseProject(JSON.parse(JSON.stringify(state.present)));state=historyReducer(restored,{type:'surface',surface:POLE});expect(state.present.modelColor?.saturation).toBe(.5);
 expect(parseModelColor(DEFAULT_MODEL_COLOR)).toEqual(DEFAULT_MODEL_COLOR);
 for(const saturation of [NaN,Infinity,-1,3])expect(()=>parseModelColor({...DEFAULT_MODEL_COLOR,saturation})).toThrow();
});
it('imported models default to ACES while explicit color mapping choices survive',()=>{
 const surface={kind:'custom' as const};expect(originalLighting(surface).toneMapping).toBe('aces');expect(resolveLighting(undefined,surface).toneMapping).toBe('aces');
 const old={...originalLighting(surface),toneMappingVersion:undefined,toneMapping:'none' as const};expect(resolveLighting(old,surface).toneMapping).toBe('aces');
 const manual={...originalLighting(surface),toneMapping:'none' as const};expect(resolveLighting(manual,surface)).toBe(manual);expect(originalLighting(POLE).toneMapping).toBe('none');
});

it('container starts at the supplied color settings and preserves manual edits',()=>{
 const scene:StickerSceneData={version:1,surface:POLE,assets:[],stickers:[]};
 const surface={id:'custom-example-cargo-container',kind:'custom' as const,height:5.4,name:'集装箱',source:'/models/cargo-container.glb'};
 let state=historyReducer(scene,{type:'surface',surface});
 expect(state.present.modelColor).toEqual({saturation:1.43,brightness:.79,contrast:1.52});
 state=historyReducer(state,{type:'model-color',modelColor:{saturation:1.2,brightness:.8,contrast:1.4}});
 state=historyReducer(state,{type:'surface',surface:POLE});
 state=historyReducer(state,{type:'surface',surface});
 expect(state.present.modelColor).toEqual({saturation:1.2,brightness:.8,contrast:1.4});
});

it.each([
 ['custom-example-peppa-pig',{saturation:1.18,brightness:.88,contrast:1.10}],
 ['custom-example-safety-helmet',{saturation:1.42,brightness:.61,contrast:.96}],
 ['custom-example-gourd',{saturation:1,brightness:1.16,contrast:1.29}],
 ['custom-example-sticky-note',{saturation:2,brightness:1.22,contrast:1.13}],
 ['custom-example-copper-hotpot',{saturation:.79,brightness:.77,contrast:1}],
 ['custom-example-clay-sofa',{saturation:1.29,brightness:.70,contrast:1.39}],
 ['road-sign-01',{saturation:1.10,brightness:.82,contrast:1.08}],
] as const)('%s uses the supplied default color', (id,settings)=>{
 expect(originalModelColor({id})).toEqual(settings);
 const scene:StickerSceneData={version:1,surface:POLE,assets:[],stickers:[]};
 const surface=id==='road-sign-01'?{id,kind:'sign' as const,height:5.4,text:'DEAD\nLINE'}:{id,kind:'custom' as const,height:5.4,name:id,source:'/models/test.glb'};
 expect(historyReducer(scene,{type:'surface',surface}).present.modelColor).toEqual(settings);
});

it('initial bundled model hydration replaces its source without discarding edits or adding undo',()=>{
 const surface={id:'custom-example-sticky-note',kind:'custom' as const,height:5.4,name:'便利贴',source:'/models/sticky-note.glb'};
 const scene:StickerSceneData={version:1,surface,assets:[],stickers:[],modelColor:{saturation:2,brightness:1.22,contrast:1.13}};
 const state=historyReducer(scene,{type:'loaded-surface',surface:{...surface,source:'data:model/gltf-binary;base64,Z2xURg=='}});
 expect((state.present.surface as typeof surface).source).toBe('data:model/gltf-binary;base64,Z2xURg==');
 expect(state.present.modelColor).toEqual(scene.modelColor);
 expect(state.past).toHaveLength(0);
 expect(historyReducer(state,{type:'loaded-surface',surface:{...surface,id:'custom-example-gourd'}})).toBe(state);
});
