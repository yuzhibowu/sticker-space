import * as THREE from 'three';
const TEXTURE_SLOTS=['map','emissiveMap','normalMap','roughnessMap','metalnessMap','alphaMap','aoMap'] as const;
/** Operates only on an export snapshot's owned textures; leave authored assets and PMREM alone. */
export function prepareExportTextureSampling(root:THREE.Object3D,maxAnisotropy:number){
 const seen=new Set<THREE.Texture>(),anisotropy=Math.max(1,Math.min(16,maxAnisotropy));
 root.traverse(object=>{
  if(!(object instanceof THREE.Mesh))return;
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   for(const slot of TEXTURE_SLOTS){
    const texture=(material as THREE.MeshStandardMaterial)[slot];
    if(!texture||seen.has(texture))continue;seen.add(texture);
    // Float data maps, externally supplied video frames and compressed mip chains have separate constraints.
    if(texture.type!==THREE.UnsignedByteType||texture instanceof THREE.DataTexture||texture instanceof THREE.CompressedTexture||texture instanceof THREE.VideoTexture||texture.isRenderTargetTexture)continue;
    texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
    texture.generateMipmaps=true;texture.anisotropy=anisotropy;texture.needsUpdate=true;
   }
  }
 });
 return seen.size;
}
