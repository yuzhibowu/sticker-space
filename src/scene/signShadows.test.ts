import {expect,it} from 'vitest';
import * as THREE from 'three';
import {installSignShadows} from './signShadows';
import {setModelShadows} from './modelShadows';
import {addStudioLights} from './lighting';
import {originalLighting,REMBRANDT_LIGHTING} from '../core/modelLighting';

it('sign filtering remains active through neutral / Rembrandt / neutral shader changes',()=>{
 const material=new THREE.MeshPhysicalMaterial();installSignShadows(material);
 for(const deferred of [false,true,false]){
  setModelShadows(material,deferred);
  const shader={...THREE.ShaderLib.physical};material.onBeforeCompile(shader as any,{} as THREE.WebGLRenderer);
  expect(shader.fragmentShader).toContain('float signBilinearShadow(');
  expect(shader.fragmentShader).toContain('fraction.y');
  expect(shader.fragmentShader).not.toContain('#include <shadowmap_pars_fragment>');
  expect(shader.fragmentShader.includes('#include <shadowmask_pars_fragment>')).toBe(deferred);
  if(deferred)expect(shader.fragmentShader.indexOf('#include <shadowmask_pars_fragment>')).toBeGreaterThan(shader.fragmentShader.indexOf('float getShadow('));
 }
 const plain=new THREE.MeshPhysicalMaterial();const shader={...THREE.ShaderLib.physical};plain.onBeforeCompile(shader as any,{} as THREE.WebGLRenderer);
 expect(shader.fragmentShader).not.toContain('signBilinearShadow');
 expect(shader.fragmentShader).toContain('#include <shadowmap_pars_fragment>');
});
it('sign shadow quality survives preset changes without increasing David shadow size',()=>{
 const scene=new THREE.Scene(),rig=addStudioLights(scene,false,true,originalLighting({kind:'sign'}));
 const key=scene.getObjectByName('StudioKey') as THREE.DirectionalLight;
 for(const settings of [originalLighting({kind:'sign'}),{...REMBRANDT_LIGHTING}]){
  rig.setSettings(settings);
  expect(key.shadow.mapSize.toArray()).toEqual([4096,4096]);
  expect(key.shadow.radius).toBe(2);expect(key.shadow.normalBias).toBe(.0015);
 }
 rig.dispose();
 const david=addStudioLights(scene,true,false,originalLighting({kind:'mesh'}));
 expect((scene.getObjectByName('StudioKey') as THREE.DirectionalLight).shadow.mapSize.toArray()).toEqual([2048,2048]);david.dispose();
});

it('grazing receivers correct each tap depth and calculate derivatives before the frustum branch',()=>{
 const material=new THREE.MeshPhysicalMaterial();installSignShadows(material);
 const shader={...THREE.ShaderLib.physical};material.onBeforeCompile(shader as any,{} as THREE.WebGLRenderer);
 const fragment=shader.fragmentShader;
 expect(fragment).toContain('dot(uv - receiver.xy, slope)');
 expect(fragment).toContain('smoothstep(compare - softness, compare + softness, depth)');
 const functionStart=fragment.indexOf('float getShadow(');
 const derivative=fragment.indexOf('vec2 receiverDX = dFdx',functionStart);
 const branch=fragment.indexOf('if ( frustumTest )',functionStart);
 expect(derivative).toBeGreaterThan(functionStart);expect(derivative).toBeLessThan(branch);
 expect(fragment).toContain('max(scale * 0.000001, 1e-20)');
 // One stable footprint is shared by forward and composited shadow callers.
 expect(fragment.match(/signBilinearShadow\(shadowMap,/g)).toHaveLength(16);
 expect(fragment).not.toContain('shadowCoord.xy + vec2(-1.0, -1.0) * texelSize * shadowRadius');
 const cacheKey=material.customProgramCacheKey();installSignShadows(material);
 expect(material.customProgramCacheKey()).toBe(cacheKey);
});
