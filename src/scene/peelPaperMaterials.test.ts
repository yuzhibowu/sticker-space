import {expect,it} from 'vitest';
import * as THREE from 'three';
import {peelPaperMaterials,setPeelPaperLayer,CARRIED_STICKER_RENDER_ORDER} from './materials';
it('keeps front printing on the front and transmitted print on the back on a separate face',()=>{
  const texture=new THREE.Texture(),paper=peelPaperMaterials(texture);
  expect(paper.front.side).toBe(THREE.FrontSide);expect(paper.back.side).toBe(THREE.BackSide);
  expect(paper.back.map).toBe(texture);expect(paper.back.alphaTest).toBeGreaterThan(0);
  const shader={fragmentShader:'#include <map_fragment>',vertexShader:'',uniforms:{}};
  paper.back.onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms,{} as THREE.WebGLRenderer);
  expect(shader.fragmentShader).toBe('#include <map_fragment>');
  expect(paper.back.color.getHex()).toBe(0xffffff);expect(paper.back.opacity).toBe(1);
  expect(shader.fragmentShader).not.toContain('gl_FrontFacing');
  paper.front.dispose();paper.back.dispose();texture.dispose();
});

it('puts a detached sheet above model depth and outlines, then restores contact depth for peeling',()=>{
  const map=new THREE.Texture(),paper=peelPaperMaterials(map),front=new THREE.Mesh(),back=new THREE.Mesh();
  setPeelPaperLayer(paper,front,back,true,5);
  expect(paper.front.depthTest).toBe(false);expect(paper.back.depthTest).toBe(false);
  expect(paper.front.depthWrite).toBe(false);expect(front.renderOrder).toBe(CARRIED_STICKER_RENDER_ORDER);expect(back.renderOrder).toBeGreaterThan(100001);
  setPeelPaperLayer(paper,front,back,false,5);
  expect(paper.front.depthTest).toBe(true);expect(paper.back.depthWrite).toBe(true);expect(front.renderOrder).toBe(7);
  paper.front.dispose();paper.back.dispose();map.dispose();
});
