import {compensateFreeformEmission,FREEFORM_EMISSION_INTENSITY} from './freeformEmission';
import {compensateKeynoteAppearance} from './keynoteAppearance';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import xatlasWasm from 'xatlasjs/dist/xatlas.wasm?url';
import xatlasScript from 'xatlasjs/dist/xatlas.js?url';
import * as THREE from 'three';
import type {StickerSceneData} from '../core/types';
import {resolveLighting} from '../core/modelLighting';
import {addStudioLights,applyStudioLighting} from '../scene/lighting';

let unwrapperPromise:Promise<import('xatlas-three').UVUnwrapper>|undefined;
function getAppearanceUnwrapper(){
 if(!unwrapperPromise)unwrapperPromise=(async()=>{
  const {UVUnwrapper}=await import('xatlas-three');
  const value=new UVUnwrapper({BufferAttribute:THREE.BufferAttribute},{resolution:2048,padding:4,bilinear:true},{useInputMeshUvs:false},true);
  await value.loadLibrary(()=>{},new URL(xatlasWasm,location.href).href,new URL(xatlasScript,location.href).href);return value;
 })().catch(error=>{unwrapperPromise=undefined;throw error;});
 return unwrapperPromise;
}
/** Rasterize the existing material in UV space, retaining world-space lighting and camera. */
export function appearanceVertexShader(source:string){
 return 'attribute vec2 appearanceUV;\n'+source.replace('#include <project_vertex>','#include <project_vertex>\n gl_Position=vec4(appearanceUV*2.0-1.0,0.0,1.0);');
}
export async function bakeUSDZAppearance(root:THREE.Group,data:StickerSceneData,report:(message:string)=>Promise<void>,target:'freeform'|'keynote'='freeform'){
 const scene=new THREE.Scene();scene.add(root);
 const meshes:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[]=[];
 root.traverse(o=>{if(o instanceof THREE.Mesh&&o.material instanceof THREE.MeshStandardMaterial)meshes.push(o);});
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
 let release:(()=>void)|undefined,lights:ReturnType<typeof addStudioLights>|undefined;
 const replacements:{mesh:typeof meshes[number];original:THREE.MeshStandardMaterial;baked:THREE.MeshPhysicalMaterial;uv:THREE.BufferAttribute|THREE.InterleavedBufferAttribute}[]=[];
 try{
  await report('USDZ · 展开独立的外观贴图坐标…');
  const unwrapper=await getAppearanceUnwrapper();
  const settings=resolveLighting(data.lighting,data.surface);
  release=applyStudioLighting(scene,renderer,settings);
  lights=addStudioLights(scene,data.surface.kind==='mesh',data.surface.kind==='sign',settings,data.surface.height);
  const camera=new THREE.PerspectiveCamera(39,1,.1,100);camera.position.fromArray(data.view?.position??[0,.18,8.8]);camera.lookAt(new THREE.Vector3().fromArray(data.view?.target??[0,0,0]));camera.zoom=data.view?.zoom??1;camera.updateProjectionMatrix();lights.update(camera);
  renderer.setClearColor(0,0);renderer.setSize(1024,1024,false);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  for(const mesh of meshes){mesh.castShadow=!mesh.userData.sticker;mesh.receiveShadow=!mesh.userData.sticker;}
  await renderer.compileAsync(scene,camera);renderer.render(scene,camera);renderer.shadowMap.autoUpdate=false;
  try{for(const mesh of meshes){const before=mesh.geometry;mesh.geometry=mergeVertices(before);before.dispose();const atlas=await unwrapper.unwrapGeometry(mesh.geometry,'uv2','uv');if(atlas.atlasCount!==1)throw new Error('模型外观需要多张图集，请关闭匹配网页外观后导出。');}}catch(error){unwrapperPromise=undefined;throw error;}
  for(const [index,mesh] of meshes.entries()){
   await report(`USDZ · 保存网页外观 ${index+1} / ${meshes.length}…`);
   const original=mesh.material,uv=mesh.geometry.getAttribute('uv2');
   if(!uv)throw new Error('模型缺少 UV，无法保存网页外观。');
   const image=(original.map??original.emissiveMap)?.image as {width?:number;height?:number}|undefined;
   const size=Math.min(renderer.capabilities.maxTextureSize,4096,Math.max(2048,image?.width??0,image?.height??0));
   renderer.setSize(size,size,false);
   const previousCompile=original.onBeforeCompile,previousKey=original.customProgramCacheKey,side=original.side,transparent=original.transparent,depthTest=original.depthTest,depthWrite=original.depthWrite;
   mesh.geometry.setAttribute('appearanceUV',uv);
   original.onBeforeCompile=function(shader,gl){previousCompile.call(this,shader,gl);shader.vertexShader=appearanceVertexShader(shader.vertexShader);shader.fragmentShader=shader.fragmentShader.replaceAll('gl_FrontFacing','true');
   };
   original.customProgramCacheKey=()=>previousKey.call(original)+'|uv-appearance-v1';original.side=THREE.DoubleSide;original.transparent=false;original.depthTest=false;original.depthWrite=false;original.needsUpdate=true;
   meshes.forEach(other=>{other.visible=other===mesh;});mesh.frustumCulled=false;
   let texture:THREE.CanvasTexture;
   try{
    renderer.render(scene,camera);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('无法保存网页外观贴图。');
    // Pad opaque UV islands before copying the original pixels, avoiding dark seams.
    if(!original.alphaTest&&!transparent)for(const [x,y] of [[-1,0],[1,0],[0,-1],[0,1]])ctx.drawImage(renderer.domElement,x,y);
    ctx.drawImage(renderer.domElement,0,0);const pixels=ctx.getImageData(0,0,size,size);(target==='keynote'?compensateKeynoteAppearance:compensateFreeformEmission)(pixels.data);ctx.putImageData(pixels,0,0);texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
   }finally{original.onBeforeCompile=previousCompile;original.customProgramCacheKey=previousKey;original.side=side;original.transparent=transparent;original.depthTest=depthTest;original.depthWrite=depthWrite;original.needsUpdate=true;mesh.geometry.deleteAttribute('appearanceUV');}
   const baked=new THREE.MeshPhysicalMaterial({map:texture,color:0x000000,emissive:0xffffff,emissiveMap:texture,emissiveIntensity:FREEFORM_EMISSION_INTENSITY,roughness:1,metalness:0,specularIntensity:0,clearcoat:0,toneMapped:false,transparent:false,alphaTest:original.alphaTest,opacity:original.opacity,side:THREE.FrontSide});
   replacements.push({mesh,original,baked,uv});
  }
  // All bakes must see original materials so reflection/shadow inputs cannot change mid-export.
  for(const {mesh,baked,uv} of replacements){mesh.material=baked;mesh.geometry.setAttribute('uv',uv);mesh.geometry.deleteAttribute('uv2');}
  return replacements.map(({baked})=>baked.id);
 }catch(error){for(const {baked} of replacements){baked.map?.dispose();baked.dispose();}throw error;}
 finally{
  meshes.forEach(mesh=>{mesh.visible=true;});
  // Original materials are no longer referenced by the export root on success.
  if(replacements.length===meshes.length)for(const original of new Set(replacements.map(r=>r.original))){for(const texture of new Set(Object.values(original).filter(v=>v instanceof THREE.Texture)))texture.dispose();original.dispose();}
  lights?.dispose();release?.();scene.remove(root);renderer.dispose();renderer.forceContextLoss();
 }
}
