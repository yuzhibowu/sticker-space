import {floatingRadius} from '../core/floating';
import {modelOrbitPivot,setModelYaw} from '../core/modelOrbit';
import {lockUSDZEmission} from './freeformEmission';
import {bakeUSDZAppearance} from './usdzAppearance';
import {bakeModelColor} from './modelColor';
import {applyModelColor} from '../scene/modelColor';
import {customMaterials} from '../core/customModel';
import {poleDimensions} from '../core/poleDimensions';
import { loadSurface } from '../core/modelSurface';
import { marbleMaterial } from '../scene/marble';
import * as THREE from 'three';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import type { StickerSceneData } from '../core/types';
import { surfaceGeometry, makeStickerGeometry } from '../core/geometry';
import { imageTexture, loadImage } from '../core/assets';
import { metalMaterial, stickerMaterial } from '../scene/materials';
import { prepareMaterialForUSDZ, type USDZOptions } from './prepareMaterialForUSDZ';
import { withExtents } from './usdzExtent';
import { prepareNormalTextures } from './normalTextures';
import { preserveUSDZStickers } from './stickerUSDZ';
import {addUSDZCamera} from './usdzCamera';
import { addUSDZTurntable } from './usdzAnimation';
import {roadSignParts} from '../core/roadSign';
import {roadSignMaterials} from '../scene/roadSignMaterials';

// 全部输出先从数据重建独立场景，永远不临时篡改网页中的 Mesh 或原始纹理。
export async function buildSceneSnapshot(data: StickerSceneData, output: 'render' | 'usdz' = 'render', appearance=false): Promise<THREE.Group> {
  await loadSurface(data.surface);
  const root = new THREE.Group(); root.name = 'StickerScene';
  const surface = new THREE.Group(); surface.name = data.surface.id; root.add(surface);
  if(data.surface.kind==='custom'){
    const geometry=surfaceGeometry(data.surface),materials=customMaterials(data.surface);
    if(output==='usdz'){
      const expanded=geometry.toNonIndexed();
      for(const [i,group] of geometry.groups.entries()){
        const part=new THREE.BufferGeometry();
        for(const key of ['position','normal','uv']){const attribute=expanded.getAttribute(key),array=new Float32Array(group.count*attribute.itemSize);for(let j=0;j<group.count;j++)for(let k=0;k<attribute.itemSize;k++)array[j*attribute.itemSize+k]=attribute.getComponent(group.start+j,k);part.setAttribute(key,new THREE.BufferAttribute(array,attribute.itemSize));}
        const body=new THREE.Mesh(part,materials[group.materialIndex??0]);body.name=`ImportedPart_${i}`;surface.add(body);
      }
      expanded.dispose();geometry.dispose();
    }else{const body=new THREE.Mesh(geometry,materials);body.name=data.surface.id;body.castShadow=body.receiveShadow=true;surface.add(body);}
  }
  else if(data.surface.kind==='sign') {
    const materials=roadSignMaterials(data.surface);
    for(const part of roadSignParts(data.surface)){const mesh=new THREE.Mesh(part.geometry,materials[part.material]);mesh.name=part.name;mesh.castShadow=mesh.receiveShadow=true;surface.add(mesh);}
  } else {
    const metal = data.surface.kind === 'mesh' ? marbleMaterial() : metalMaterial();
    const body = new THREE.Mesh(surfaceGeometry(data.surface), metal); body.name = data.surface.kind === 'mesh' ? 'David' : 'MetalPole'; body.castShadow=body.receiveShadow=data.surface.kind === 'mesh'; surface.add(body);
    if (data.surface.kind === 'cylinder') for (const sign of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CircleGeometry(data.surface.radius, 192), metal);
      const lengths=poleDimensions(data.surface);cap.position.y = sign===1?lengths.upper:-lengths.lower; cap.rotation.x = -sign * Math.PI / 2; surface.add(cap);
    }
  }
  const modelMaterials=new Set<THREE.Material>();surface.traverse(o=>{if(o instanceof THREE.Mesh)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>modelMaterials.add(m));});
  if(output==='usdz'&&!appearance&&data.modelColor&&Object.values(data.modelColor).some(n=>n!==1)){const cache=new Map<string,THREE.Texture>();for(const m of modelMaterials)if(m instanceof THREE.MeshStandardMaterial)bakeModelColor(m,data.modelColor,cache);}
  if(output==='render'||appearance)modelMaterials.forEach(m=>applyModelColor(m,data.modelColor));
  const textures = new Map<string, THREE.Texture>();
  await Promise.all(data.assets.filter(a => data.stickers.some(s => s.assetId === a.id)).map(async a => {
    textures.set(a.id, imageTexture(await loadImage(a.image)));
  }));
  for (const s of data.stickers) {
    const texture = textures.get(s.assetId); if (!texture) throw new Error('工程中有贴纸图片缺失');
    const mesh = new THREE.Mesh(makeStickerGeometry(s, data.surface), stickerMaterial(texture,appearance?'render':output));
    mesh.name = `Sticker_${s.id}`; mesh.userData.sticker = true; mesh.renderOrder = s.order + 1; surface.add(mesh);
  }
  setModelYaw(root,0,modelOrbitPivot(data.surface),data.modelTilt??0);
  root.updateMatrixWorld(true); return root;
}

export function disposeSnapshot(root: THREE.Group) {
  const materials = new Set<THREE.MeshStandardMaterial>(), textures = new Set<THREE.Texture>();
  root.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.dispose(); (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m as THREE.MeshStandardMaterial));
  });
  materials.forEach(m => { Object.values(m).filter(t=>t instanceof THREE.Texture).forEach(t => { if (t) textures.add(t); }); m.dispose(); });
  textures.forEach(t => t.dispose());
}

export async function exportUSDZ(data: StickerSceneData, options: USDZOptions, progress: (message:string)=>void = () => {}) {
  const report = async (message:string) => { progress(message); await new Promise(resolve=>setTimeout(resolve,0)); };
  await report('USDZ · 准备模型与贴纸…');
  const root = await buildSceneSnapshot(data, 'usdz',options.appearance);
  try {
    const appearanceIds=options.appearance?await bakeUSDZAppearance(root,data,report,options.target):[];
    await report('USDZ · 准备材质…');
    const stickers: THREE.Mesh[] = [];
    root.traverse(o => { if (o instanceof THREE.Mesh && o.userData.sticker) stickers.push(o); });
    // 同一原图的导出校正纹理复用；副本内部也不必重复烘焙或重复打包。
    const cache = new Map<THREE.Texture, THREE.Texture>();
    for (const mesh of stickers) {
      const material = mesh.material as THREE.MeshPhysicalMaterial;
      if(!options.appearance)await prepareMaterialForUSDZ(material, options, cache);
      // r169 在 transparent=true 时会漏掉 opacityThreshold。Quick Look 实测会让
      // PNG 的透明矩形仍改变杆身受光。纸张导出使用标准 Alpha 裁切分支，保留原
      // Alpha 贴图并写入阈值；只改独立副本，网页仍保留连续半透明混合。
      material.transparent = false;
      material.alphaTest = 0.015;
      // USDZ 没有 WebGL 的 polygonOffset，真实抬起纸面，避免原生应用的深度精度吞掉贴纸。
      const positions=mesh.geometry.getAttribute('position'), normals=mesh.geometry.getAttribute('normal');
      for(let i=0;i<positions.count;i++) positions.setXYZ(i,positions.getX(i)+normals.getX(i)*.002,positions.getY(i)+normals.getY(i)*.002,positions.getZ(i)+normals.getZ(i)*.002);
      mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
    }
    const maxTextureSize = Math.max(options.appearance?4096:1024, ...data.assets.map(a => Math.max(a.width, a.height)));
    await report('USDZ · 打包模型与纹理…');
    const buffer = await new USDZExporter().parseAsync(root, { maxTextureSize, quickLookCompatible: false, includeAnchoringProperties: false });
    const complete=await preserveUSDZStickers(buffer,stickers.map(mesh=>({objectId:mesh.id,geometryId:mesh.geometry.id,stickerId:mesh.name.slice(8)})));
    await report('USDZ · 完成文件结构…');
    return withExtents(complete, (text,name) => {
      let sceneText=name==='model.usda'?lockUSDZEmission(text,appearanceIds):text;
      if(name==='model.usda'&&options.animation)sceneText=addUSDZTurntable(sceneText,{...options.animation,enabled:data.motion?.enabled,floating:data.floating,radius:data.floating?.enabled?floatingRadius(data.surface):0,tilt:data.modelTilt,pivot:modelOrbitPivot(data.surface).toArray() as [number,number,number]});
      if(name==='model.usda'&&options.framing)sceneText=addUSDZCamera(sceneText,options.framing.view,options.framing.width,options.framing.height);
      const prepared=prepareNormalTextures(sceneText);
      if(data.surface.kind==='sign' && name==='model.usda'){const signText=data.surface.text;return prepared.replace(/string creator = "[^"\n]*"/,match=>match+'\n\t\tstring roadSignText = '+JSON.stringify(signText));}
      if (data.surface.kind !== 'mesh') return prepared;
      return prepared.replace(/string creator = "[^"\n]*"/, '$&\n\t\tstring davidScanAuthor = "Scan the World @ MyMiniFactory.com / Jonathan Beck"\n\t\tstring davidGeometryLicense = "CC BY-SA 4.0; https://creativecommons.org/licenses/by-sa/4.0/"\n\t\tstring davidSource = "https://commons.wikimedia.org/wiki/File:David_(Michelangelo).stl"\n\t\tstring davidAdaptation = "Centered, scaled, simplified, smooth normals, stone UVs and PBR textures"');
    });
  } finally { disposeSnapshot(root); }
}

// 预留渲染合同：Image 使用独立分辨率；Video 传 frame/fps；USDZ 使用最终静态副本。
export interface OfflineRenderSession {
  renderAtTime(time: number): void;
  renderImage(options: { width: number; height: number; transparent: boolean }): Promise<Blob>;
  dispose(): void;
}
