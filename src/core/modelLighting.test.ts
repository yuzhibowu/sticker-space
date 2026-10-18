import {expect,it} from 'vitest';
import {DEFAULT_LIGHTING,REMBRANDT_LIGHTING,parseLighting,originalLighting,resolveLighting} from './modelLighting';
import {historyReducer} from './StickerManager';
import {parseProject} from './project';
import {POLE,DAVID,type StickerSceneData} from './types';
const scene:StickerSceneData={version:1,surface:POLE,assets:[{id:'png',name:'test',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',width:1,height:1}],stickers:[]};
it('lighting mirrors the 3D project and validates independent finite controls',()=>{
 expect(DEFAULT_LIGHTING).toEqual({exposure:1,environmentIntensity:.42,keyLightIntensity:.68,fillLightIntensity:.26,shadowIntensity:0,keyAngleX:-35,keyAngle:40,toneMapping:'aces'});
 expect(parseLighting(REMBRANDT_LIGHTING)).toEqual(REMBRANDT_LIGHTING);
 for(const bad of [{exposure:Infinity},{environmentIntensity:-1},{shadowIntensity:1.1},{keyAngle:181},{toneMapping:'wrong'}])expect(()=>parseLighting({...DEFAULT_LIGHTING,...bad})).toThrow();
});
it('lighting is saved per model, grouped for undo, and round-trips with old projects',()=>{
 expect(parseProject(scene).lighting).toBeUndefined();
 let state=historyReducer(scene,{type:'lighting',lighting:{...DEFAULT_LIGHTING,exposure:1.2},group:'lighting-exposure'});
 state=historyReducer(state,{type:'lighting',lighting:{...DEFAULT_LIGHTING,exposure:1.5},group:'lighting-exposure'});expect(state.past).toHaveLength(1);
 expect(historyReducer(state,{type:'undo'}).present.lighting).toBeUndefined();
 state=historyReducer(state,{type:'surface',surface:DAVID});expect(state.present.lighting).toBeUndefined();
 state=historyReducer(state,{type:'lighting',lighting:{...REMBRANDT_LIGHTING}});
 const restored=parseProject(JSON.parse(JSON.stringify(state.present)));expect(restored.lighting).toEqual(REMBRANDT_LIGHTING);expect(restored.otherModels![0].lighting?.exposure).toBe(1.5);
 state=historyReducer(restored,{type:'surface',surface:POLE});expect(state.present.lighting?.exposure).toBe(1.5);
});
it('neutral preserves original model lighting while explicitly modified studio settings survive',()=>{
 expect(resolveLighting(undefined,DAVID)).toEqual(originalLighting(DAVID));
 expect(resolveLighting({...DEFAULT_LIGHTING},DAVID)).toEqual(originalLighting(DAVID));
 const changed={...REMBRANDT_LIGHTING,exposure:1.2};expect(resolveLighting(changed,DAVID)).toBe(changed);
 expect(parseLighting(originalLighting(DAVID))).toEqual(originalLighting(DAVID));
 const saved=parseProject({...scene,lighting:originalLighting(POLE)});expect(saved.lighting?.profile).toBe('original');
});
it('old untouched road-sign neutral upgrades to a short gentle shadow, while custom lights survive',()=>{
 const surface={kind:'sign' as const},neutral=originalLighting(surface);
 const old={...neutral,keyLightIntensity:2.2,shadowIntensity:1,keyAngleX:-Math.atan2(4,5)*180/Math.PI,keyAngle:Math.asin(-3/Math.sqrt(50))*180/Math.PI};
 expect(resolveLighting(old,surface)).toEqual(neutral);
 expect(neutral.shadowIntensity).toBe(.16);
 expect(Math.abs(neutral.keyAngleX)).toBeLessThan(8);
 expect(Math.abs(neutral.keyAngle)).toBeLessThan(5);
 const custom={...old,keyLightIntensity:1.9};expect(resolveLighting(custom,surface)).toBe(custom);
});
it('uses the screenshot lighting for Maotai while retaining manual adjustments',()=>{
 const surface={kind:'custom' as const,id:'custom-example-maotai'};
 const expected={profile:'original',toneMappingVersion:1,exposure:.86,environmentIntensity:.98,keyLightIntensity:1.87,fillLightIntensity:.5,shadowIntensity:0,keyAngle:-35,keyAngleX:-43,toneMapping:'aces'};
 expect(resolveLighting(undefined,surface)).toEqual(expected);
 expect(resolveLighting({...DEFAULT_LIGHTING},surface)).toEqual(expected);
 expect(parseLighting(originalLighting(surface))).toEqual(expected);
 const adjusted={...originalLighting(surface),exposure:1.2};expect(resolveLighting(adjusted,surface)).toBe(adjusted);
});
it('uses the reference-calibrated exposure for sticky notes across preview, export and reset',()=>{
 const note={kind:'custom' as const,id:'custom-example-sticky-note'},neutral=originalLighting(note);
 expect(resolveLighting(undefined,note).exposure).toBe(.6);
 expect(resolveLighting({...DEFAULT_LIGHTING},note)).toEqual(neutral);
 expect(parseLighting(neutral)).toEqual(neutral);
 const manual={...neutral,exposure:.9};expect(resolveLighting(manual,note)).toBe(manual);
 expect(originalLighting({kind:'custom',id:'custom-example-safety-helmet'}).exposure).toBe(1);
});
it('uses the requested lemon and egg lighting without overriding manual changes',()=>{
 const lemon={kind:'custom' as const,id:'custom-example-lemon'},egg={kind:'custom' as const,id:'custom-example-egg'};
 expect(originalLighting(lemon)).toMatchObject({environmentIntensity:.94,keyLightIntensity:2.24});
 expect(resolveLighting(undefined,egg).environmentIntensity).toBe(2.23);
 expect(resolveLighting({...originalLighting(lemon),environmentIntensity:2.86,keyLightIntensity:1.25},lemon)).toEqual(originalLighting(lemon));
 const manual={...originalLighting(lemon),environmentIntensity:1.1};
 expect(resolveLighting(manual,lemon)).toBe(manual);
});

it('uses the requested hammer environment while preserving manual light edits',()=>{
 const surface={kind:'custom' as const,id:'custom-example-mjolnir'},neutral=originalLighting(surface);
 expect(neutral.environmentIntensity).toBe(1.71);
 expect(resolveLighting({...neutral,environmentIntensity:2.86},surface)).toEqual(neutral);
 const manual={...neutral,environmentIntensity:1.5};expect(resolveLighting(manual,surface)).toBe(manual);
});
