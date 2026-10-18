import {expect,it} from 'vitest';
import * as THREE from 'three';
import {DEFAULT_FLOATING,floatingPose,applyModelMotion,parseFloating} from './floating';
import {historyReducer} from './StickerManager';
import {parseProject} from './project';
import {POLE,DAVID,type StickerSceneData} from './types';
it('defaults off and never changes the independent rotation when disabled',()=>{
 expect(DEFAULT_FLOATING.enabled).toBe(false);
 const root=new THREE.Group();applyModelMotion(root,1.2,new THREE.Vector3(),0,DEFAULT_FLOATING,2,4,3);
 expect(root.rotation.y).toBeCloseTo(1.2);expect(root.position.length()).toBe(0);
});
it('matches the PNG reference phase, amplitude and full-cycle derivatives',()=>{
 const settings={enabled:true,amount:1},radius=3,period=4;
 for(const t of [0,1,2,3,4]){const p=floatingPose(settings,t,period,radius),cycle=2*Math.PI*t/period;
  expect(p.y).toBeCloseTo(-Math.cos(cycle)*.047*radius,10);
  expect(p.tiltX).toBeCloseTo(Math.cos(cycle*2+.35)*.012,10);
  expect(p.tiltZ).toBeCloseTo(-Math.sin(cycle+.7)*.014,10);
 }
 expect(floatingPose(settings,0,4,3)).toEqual(floatingPose(settings,4,4,3));
 const eps=1e-5;
 for(const key of ['y','tiltX','tiltZ'] as const){const left=(floatingPose(settings,4,4,3)[key]-floatingPose(settings,4-eps,4,3)[key])/eps,right=(floatingPose(settings,eps,4,3)[key]-floatingPose(settings,0,4,3)[key])/eps;expect(left).toBeCloseTo(right,4);}
});
it('rotates and floats as one parent transform with an exact shared loop',()=>{
 const root=new THREE.Group(),pivot=new THREE.Vector3(.2,1,-.1),settings={enabled:true,amount:3};
 applyModelMotion(root,0,pivot,35,settings,0,8,3);const first=root.matrix.compose(root.position,root.quaternion,root.scale).clone();
 applyModelMotion(root,Math.PI*2,pivot,35,settings,8,8,3);const last=root.matrix.compose(root.position,root.quaternion,root.scale);
 last.elements.forEach((x,i)=>expect(x).toBeCloseTo(first.elements[i],9));
 const p=pivot.clone().applyMatrix4(last);expect(p.x).toBeCloseTo(pivot.x);expect(p.y).toBeCloseTo(pivot.y-.047*3*3);
});
it('persists per-model settings through undo, switches and project files',()=>{
 const scene:StickerSceneData={version:1,surface:POLE,assets:[{id:'a',name:'test',width:1,height:1,image:'data:image/png;base64,iVBORw0KGgoAAA=='}],stickers:[]};
 let state=historyReducer(scene,{type:'floating',floating:{enabled:true,amount:1.5}});
 expect(historyReducer(state,{type:'undo'}).present.floating).toBeUndefined();
 state=historyReducer(state,{type:'surface',surface:DAVID});expect(state.present.floating).toBeUndefined();
 state=historyReducer(state,{type:'surface',surface:POLE});expect(parseProject(state.present).floating).toEqual({enabled:true,amount:1.5});
 expect(parseFloating(undefined)).toBeUndefined();for(const v of [{enabled:true,amount:4},{enabled:1,amount:1}])expect(()=>parseFloating(v)).toThrow();
});
