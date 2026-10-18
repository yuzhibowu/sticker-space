import {expect,it,vi} from 'vitest';
import * as THREE from 'three';
vi.mock('./studioEnv',()=>({STUDIO_ENV_INTENSITY:2.86,makeStudioEnvironment:()=>new THREE.Texture()}));
vi.mock('./galvanizedMetal',()=>({makePoleEnvironment:()=>({texture:new THREE.Texture(),dispose:()=>{}})}));
import {applyStudioLighting} from './lighting';
import {originalLighting} from '../core/modelLighting';
it('imported metals retain their environment instead of inheriting the pole reflection',()=>{
 const scene=new THREE.Scene(),sourceEnvironment=new THREE.Texture(),imported=new THREE.MeshStandardMaterial({metalness:1,roughness:.25,envMap:sourceEnvironment,envMapIntensity:.7}),pole=new THREE.MeshStandardMaterial({metalness:1});
 imported.userData.imported=true;scene.add(new THREE.Mesh(new THREE.BoxGeometry(),imported),new THREE.Mesh(new THREE.BoxGeometry(),pole));
 const rig=applyStudioLighting(scene,{} as THREE.WebGLRenderer,originalLighting({kind:'custom'}));
 expect(imported.envMap).toBe(sourceEnvironment);expect(imported.envMapIntensity).toBe(.7);expect(imported.roughness).toBe(.25);expect(pole.envMap).not.toBeNull();expect(pole.envMap).not.toBe(sourceEnvironment);
 rig.setSettings({...originalLighting({kind:'custom'}),environmentIntensity:1});rig.refresh();expect(imported.envMap).toBe(sourceEnvironment);expect(imported.envMapIntensity).toBe(.7);rig();
});
