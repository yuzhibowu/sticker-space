import {expect,it} from 'vitest';
import * as THREE from 'three';
import {applyModelColor} from './modelColor';
it('model color keeps texture identity and updates shader uniforms without recompilation',()=>{
 const map=new THREE.Texture(),material=new THREE.MeshStandardMaterial({map});applyModelColor(material);
 const shader={uniforms:{},fragmentShader:THREE.ShaderLib.standard.fragmentShader,vertexShader:''};material.onBeforeCompile(shader as any,{} as THREE.WebGLRenderer);
 expect(shader.fragmentShader).toContain('diffuseColor.rgb=adjustModelColor');expect(shader.fragmentShader).toContain('return linearColor;');
 const version=material.version;applyModelColor(material,{saturation:0,brightness:1.1,contrast:1.2});expect(material.version).toBe(version);expect(material.map).toBe(map);
 expect((shader.uniforms as any).modelSaturation.value).toBe(0);expect((shader.uniforms as any).modelBrightness.value).toBe(1.1);
});
