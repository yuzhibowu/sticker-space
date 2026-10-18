import {it,expect} from 'vitest';
import * as THREE from 'three';
import {prepareCustomObject} from './customModel';
import {parseProject} from './project';
import {historyReducer} from './StickerManager';
import {DEFAULT_MOTION} from './motion';
import {POLE,DAVID,type SurfaceData,type StickerSceneData} from './types';
it('模型整体归一化，保留不同材质、世界变换和可贴的法线与 BVH',()=>{
 const group=new THREE.Group();group.position.set(8,2,-3);const box=new THREE.Mesh(new THREE.BoxGeometry(2,3,1),[0,1,2,3,4,5].map(i=>new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(i/6,.5,.5)})));box.rotation.y=.4;group.add(box);
 const result=prepareCustomObject(group);const size=result.geometry.boundingBox!.getSize(new THREE.Vector3());expect(Math.max(...size.toArray())).toBeCloseTo(5.4);expect(result.geometry.boundingBox!.getCenter(new THREE.Vector3()).length()).toBeLessThan(1e-6);expect(result.materials).toHaveLength(6);expect(result.geometry.groups).toHaveLength(6);expect((result.geometry as any).boundsTree).toBeTruthy();expect(result.materials[0]).not.toBe(box.material[0]);
});
it('GLB 内嵌数据、多个自定义模型和每个模型的动画随工程保存',()=>{
 const surface=(id:string):SurfaceData=>({id:'custom-'+id,kind:'custom',height:5.4,name:'测试',source:'data:model/gltf-binary;base64,Z2xURgAAAA=='});
 const scene:StickerSceneData={version:1,surface:POLE,assets:[{id:'a',name:'png',width:1,height:1,image:'data:image/png;base64,iVBORw0KGgoAAA=='}],stickers:[]};
 let state=historyReducer(scene,{type:'surface',surface:surface('a')});state=historyReducer(state,{type:'motion',motion:{...DEFAULT_MOTION,mode:'sequence'}});state=historyReducer(state,{type:'surface',surface:surface('b')});state=historyReducer(state,{type:'surface',surface:DAVID});
 const parsed=parseProject(state.present);expect(parsed.otherModels).toHaveLength(3);state=historyReducer(parsed,{type:'surface',surface:surface('a')});expect(state.present.motion?.mode).toBe('sequence');expect(()=>parseProject({...state.present,surface:{...surface('a'),source:'https://example.com/file.glb'}})).toThrow();
});
it('无三角形模型不会覆盖现有作品',()=>{expect(()=>prepareCustomObject(new THREE.Group())).toThrow('没有可贴纸');});

it('unlit imported materials retain original color and ignore studio reflections',()=>{
 const map=new THREE.Texture(),source=new THREE.MeshBasicMaterial({color:0xff8844,map,side:THREE.DoubleSide});
 const {materials}=prepareCustomObject(new THREE.Mesh(new THREE.BoxGeometry(),source));
 expect(materials[0].emissive.getHex()).toBe(source.color.getHex());expect(materials[0].emissiveMap).toBe(map);expect(materials[0].color.getHex()).toBe(0);expect(materials[0].metalness).toBe(0);expect(materials[0].toneMapped).toBe(false);expect(materials[0].side).toBe(THREE.DoubleSide);
});
