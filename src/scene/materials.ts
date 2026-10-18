import * as THREE from 'three';
import { galvanizedMaps } from './galvanizedMetal';

export function stickerMaterial(map: THREE.Texture, output: 'render' | 'usdz' = 'render') {
  const originalColor = output === 'render';
  return new THREE.MeshPhysicalMaterial({
    // 网页和视频通过标准 PBR 的自发光通道直接显示原图，关闭漫反射与白色高光，避免灯光把颜色冲淡。
    // Alpha 仍来自原始 map；曲面几何和原图都不变。USDZ 则创建独立的受光材质供苹果端校正。
    map, color: originalColor ? 0x000000 : 0xffffff,
    emissive: originalColor ? 0xffffff : 0x000000, emissiveMap: originalColor ? map : null,
    specularIntensity: originalColor ? 0 : 1, toneMapped: !originalColor,
    roughness: 0.9, metalness: 0, clearcoat: 0,
    // Keep the model's depth for front/back occlusion, but composite attached
    // sheets in renderOrder. Independently triangulated wraps can cross by a few
    // microns; writing each sheet's depth punches holes in the next layer.
    transparent: true, alphaTest: 0.015, depthWrite: !originalColor,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    // Attached ink only faces outward; on a single-sheet model it must not
    // remain visible when viewed through the reverse of the paper.
    side: THREE.FrontSide,
  });
}

/** The same printed colors show through both sides of the thin paper. */
export function peelPaperMaterials(map:THREE.Texture){
  const front=stickerMaterial(map);front.side=THREE.FrontSide;
  const back=new THREE.MeshBasicMaterial({map,color:'white',side:THREE.BackSide,transparent:true,alphaTest:.015,depthWrite:true,toneMapped:false});
  return {front,back};
}

export const CARRIED_STICKER_RENDER_ORDER = 100010;

/** Once lifted, the sheet belongs to the preview overlay, above all model depths and outlines. */
export function setPeelPaperLayer(paper:ReturnType<typeof peelPaperMaterials>,front:THREE.Mesh,back:THREE.Mesh,detached:boolean,order:number){
  paper.front.depthTest=paper.back.depthTest=!detached;
  paper.front.depthWrite=paper.back.depthWrite=!detached;
  front.renderOrder=back.renderOrder=detached?CARRIED_STICKER_RENDER_ORDER:order+2;
}

export function metalMaterial() {
  // 颜色、粗糙度与微法线分开：斑驳不会随镜头转动，反光会随圆柱法线改变。
  return new THREE.MeshPhysicalMaterial({ ...galvanizedMaps(), color: '#f2f2f2', metalness: 0.96, roughness: 1 });
}

export function disposeMaterial(material: THREE.MeshStandardMaterial) {
  const maps = new Set(Object.values(material).filter(value=>value instanceof THREE.Texture) as THREE.Texture[]);
  maps.forEach(t => t?.dispose()); material.dispose();
}
