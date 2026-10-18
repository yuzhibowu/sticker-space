import * as THREE from 'three';
import {expect,it} from 'vitest';
import {prepareExportTextureSampling} from './textureSampling';
it('修正茅台GLB的无mipmap缩小采样，并按显卡能力提供斜视过滤',()=>{
 const authored=new THREE.Texture({width:2048,height:2048} as HTMLImageElement);authored.minFilter=THREE.LinearFilter;authored.generateMipmaps=false;
 const copy=authored.clone(),material=new THREE.MeshStandardMaterial({map:copy,emissiveMap:copy}),root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(),material));
 const version=copy.version;prepareExportTextureSampling(root,8);
 expect(copy.minFilter).toBe(THREE.LinearMipmapLinearFilter);expect(copy.generateMipmaps).toBe(true);expect(copy.anisotropy).toBe(8);expect(copy.version).toBe(version+1);
 expect(authored.minFilter).toBe(THREE.LinearFilter);expect(authored.generateMipmaps).toBe(false);expect(authored.anisotropy).toBe(1);
});
it('不覆盖环境纹理、数据纹理和压缩纹理的特殊采样设置',()=>{
 const env=new THREE.Texture(),data=new THREE.DataTexture(new Uint8Array(4),1,1),compressed=new THREE.CompressedTexture([],4,4);
 const material=new THREE.MeshStandardMaterial({map:compressed,normalMap:data,envMap:env}),root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(),material));
 const versions=[env.version,data.version,compressed.version];prepareExportTextureSampling(root,16);
 expect([env.version,data.version,compressed.version]).toEqual(versions);
});
it('各向异性级别不超过设备限制',()=>{
 const texture=new THREE.Texture(),root=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({map:texture}));
 prepareExportTextureSampling(root,32);expect(texture.anisotropy).toBe(16);prepareExportTextureSampling(root,1);expect(texture.anisotropy).toBe(1);
});
