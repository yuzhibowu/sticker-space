import * as THREE from 'three';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {mergeGeometries,mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import type {SurfaceData} from './types';
export type CustomSurface=Extract<SurfaceData,{kind:'custom'}>;
const installed:Map<string,{source:string;geometry:THREE.BufferGeometry;materials:THREE.MeshStandardMaterial[]}>=import.meta.hot?.data.customModels??new Map();
if(import.meta.hot)import.meta.hot.dispose(data=>{data.customModels=installed;});
const pending=new Map<string,Promise<void>>();
const parsedResources=new Map<string,Promise<ReturnType<typeof prepareCustomObject>>>();
const embeddedBuffers=new Map<string,ArrayBuffer>();
export function cacheCustomModelBytes(source:string,buffer:ArrayBuffer){embeddedBuffers.set(source,buffer);}
const LIMIT=60*1024*1024;
/** Preserve glTF unlit materials when converting to the shared export-compatible material type. */
function importedMaterial(source:THREE.Material|undefined){
 if(source instanceof THREE.MeshStandardMaterial)return source.clone();
 const basic=source as THREE.MeshBasicMaterial|undefined;
 const converted=new THREE.MeshStandardMaterial({color:0x000000,emissive:basic?.color??0xcccccc,emissiveMap:basic?.map??null,map:basic?.map??null,roughness:1,metalness:0,toneMapped:false,side:basic?.side??THREE.FrontSide,transparent:basic?.transparent??false,opacity:basic?.opacity??1,alphaTest:basic?.alphaTest??0});
 converted.userData.importedUnlit=true;return converted;
}
/** 解包后成为一个静态的可贴表面；模型、材质和贴图全部保存在工程中。 */
export function prepareCustomObject(object:THREE.Object3D){
 object.updateMatrixWorld(true);
 const parts:THREE.BufferGeometry[]=[],materials:THREE.MeshStandardMaterial[]=[];let triangles=0;
 object.traverse(node=>{
  if(!(node instanceof THREE.Mesh)||!node.visible)return;
  const source=node.geometry;if(!source.getAttribute('position'))return;
  const matrices:THREE.Matrix4[]=[];
  if(node instanceof THREE.InstancedMesh){if(node.count>10000)throw new Error('模型实例过多');for(let i=0;i<node.count;i++){const m=new THREE.Matrix4();node.getMatrixAt(i,m);matrices.push(node.matrixWorld.clone().multiply(m));}}
  else matrices.push(node.matrixWorld);
  const used=Array.isArray(node.material)?node.material:[node.material];
  for(const matrix of matrices){
   const indexed=source.clone();if(!indexed.getAttribute('normal'))indexed.computeVertexNormals();
   const geometry=indexed.index?indexed.toNonIndexed():indexed.clone();indexed.dispose();
   const count=geometry.getAttribute('position').count;triangles+=count/3;if(triangles>1_000_000)throw new Error('模型超过 100 万三角形，请先简化模型。');
   const groups=geometry.groups.length?geometry.groups:[{start:0,count,materialIndex:0}];
   for(const group of groups){
    const length=Math.min(group.count,count-group.start);if(length<3)continue;
    const part=new THREE.BufferGeometry();
    for(const key of ['position','normal','uv']){
      const input=geometry.getAttribute(key),size=key==='uv'?2:3,out=new Float32Array(length*size);
      for(let i=0;i<length;i++)for(let j=0;j<size;j++)out[i*size+j]=input?input.getComponent(group.start+i,j):0;
      part.setAttribute(key,new THREE.BufferAttribute(out,size));
    }
    if(node instanceof THREE.SkinnedMesh){node.skeleton.update();const position=part.getAttribute('position'),p=new THREE.Vector3();for(let i=0;i<length;i++){const sourceIndex=source.index?.getX(group.start+i)??group.start+i;node.applyBoneTransform(sourceIndex,p.fromBufferAttribute(position,i));position.setXYZ(i,p.x,p.y,p.z);}part.computeVertexNormals();}
    part.applyMatrix4(matrix);
    if(matrix.determinant()<0)for(const key of ['position','normal','uv']){const a=part.getAttribute(key);for(let i=0;i<a.count;i+=3)for(let j=0;j<a.itemSize;j++){const temp=a.getComponent(i+1,j);a.setComponent(i+1,j,a.getComponent(i+2,j));a.setComponent(i+2,j,temp);}}
    const original=used[group.materialIndex??0];
    const material=importedMaterial(original);
    material.name=original?.name??'模型材质';material.userData={...material.userData,imported:true};
    parts.push(part);materials.push(material);
   }
   geometry.dispose();
  }
 });
 if(!parts.length)throw new Error('文件中没有可贴纸的三角形模型。');
 const joined=mergeGeometries(parts,true);parts.forEach(g=>g.dispose());if(!joined)throw new Error('模型几何数据无法合并。');
 joined.computeBoundingBox();const box=joined.boundingBox!,size=box.getSize(new THREE.Vector3()),extent=Math.max(size.x,size.y,size.z);
 if(!Number.isFinite(extent)||extent<=1e-6)throw new Error('模型尺寸无效。');
 joined.translate(...box.getCenter(new THREE.Vector3()).negate().toArray() as [number,number,number]);joined.scale(5.4/extent,5.4/extent,5.4/extent);
 const geometry=mergeVertices(joined,1e-6);joined.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 (geometry as THREE.BufferGeometry &{boundsTree:MeshBVH}).boundsTree=new MeshBVH(geometry);
 return {geometry,materials};
}
export function customModel(surface:CustomSurface){const value=installed.get(surface.id);if(!value||value.source!==surface.source)throw new Error('自定义模型尚未加载。');return value;}
export function customMaterials(surface:CustomSurface){
 const textures=new Map<THREE.Texture,THREE.Texture>();
 return customModel(surface).materials.map(source=>{const material=source.clone();for(const [key,value] of Object.entries(source))if(value instanceof THREE.Texture){let copy=textures.get(value);if(!copy){copy=value.clone();copy.needsUpdate=true;textures.set(value,copy);}(material as any)[key]=copy;}return material;});
}
export async function loadCustomSurface(surface:CustomSurface){
 if(installed.get(surface.id)?.source===surface.source)return;
 if(pending.has(surface.id)){await pending.get(surface.id);if(installed.get(surface.id)?.source!==surface.source)return loadCustomSurface(surface);return;}
 const promise=(async()=>{
  let resource=parsedResources.get(surface.source);
  if(!resource){resource=(async()=>{const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);const result=await loader.parseAsync(await dataBuffer(surface.source),'');return await restoreBundledObject(result)??prepareCustomObject(result.scene);})();parsedResources.set(surface.source,resource);resource.catch(()=>parsedResources.delete(surface.source));}
  const prepared=await resource;installed.set(surface.id,{...prepared,source:surface.source});
 })();
 pending.set(surface.id,promise);try{await promise;}finally{pending.delete(surface.id);}
}
/** Bundled GLBs already contain a normalized, indexed mesh and serialized BVH. */
async function restoreBundledObject(result:GLTF):Promise<ReturnType<typeof prepareCustomObject>|undefined>{
 const metadata=result.asset.extras?.stickerLabPrepared;
 if(metadata?.version!==1)return;
 const parser=result.parser;
 const [position,normal,uv,index,roots]=await Promise.all([
  parser.getDependency('accessor',metadata.position),parser.getDependency('accessor',metadata.normal),parser.getDependency('accessor',metadata.uv),parser.getDependency('accessor',metadata.index),
  Promise.all(metadata.bvhRoots.map((view:number)=>parser.getDependency('bufferView',view))),
 ]);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',position);geometry.setAttribute('normal',normal);geometry.setAttribute('uv',uv);geometry.setIndex(index);
 for(const group of metadata.groups)geometry.addGroup(group.start,group.count,group.materialIndex);
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 (geometry as THREE.BufferGeometry &{boundsTree:MeshBVH}).boundsTree=MeshBVH.deserialize({roots,index:index.array},geometry,{setIndex:false});
 const original=await Promise.all(result.parser.json.materials.map((_:unknown,i:number)=>parser.getDependency('material',i))) as THREE.Material[];
 const materials=original.map(material=>{const converted=importedMaterial(material);converted.name=material.name;converted.userData={...converted.userData,imported:true};return converted;});
 return {geometry,materials};
}
function dataBuffer(source:string){const buffer=embeddedBuffers.get(source);if(buffer){embeddedBuffers.delete(source);return Promise.resolve(buffer);}return fetch(source).then(r=>r.arrayBuffer());}
function dataURL(buffer:ArrayBuffer){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as string);reader.onerror=()=>reject(new Error('无法保存模型数据'));reader.readAsDataURL(new Blob([buffer],{type:'model/gltf-binary'}));});}
export async function importCustomModel(files:File[]):Promise<CustomSurface>{
 const roots=files.filter(f=>/\.(glb|gltf|usdz)$/i.test(f.name));if(roots.length!==1)throw new Error('请选择一个 GLB、GLTF 或 USDZ 模型；GLTF 请同时选择 BIN 和贴图，或导入整个文件夹。');
 if(files.reduce((n,f)=>n+f.size,0)>LIMIT)throw new Error('模型和贴图合计请小于 60 MB。');
 const root=roots[0],urls:string[]=[],manager=new THREE.LoadingManager();
 const find=(requested:string)=>{const path=decodeURIComponent(requested).replace(/\\/g,'/').replace(/^\.\//,'');const exact=files.filter(f=>(f.webkitRelativePath||f.name)===path||(f.webkitRelativePath||f.name).endsWith('/'+path));if(exact.length===1)return exact[0];const matches=files.filter(f=>f.name===path.split('/').at(-1));if(matches.length===1)return matches[0];throw new Error(`缺少模型资源：${path}。请同时选择模型、BIN 和全部贴图。`);};
 manager.setURLModifier(url=>{if(url.startsWith('data:')||url.startsWith('blob:')||url.startsWith('/decoders/draco/'))return url;const file=find(url),object=URL.createObjectURL(file);urls.push(object);return object;});
 let draco:DRACOLoader|undefined,prepared:ReturnType<typeof prepareCustomObject>|undefined;
 try{
  let object:THREE.Object3D;
  if(/\.usdz$/i.test(root.name)){
   const {USDLoader}=await import('../vendor/usd/USDLoader.js');
   const buffer=await root.arrayBuffer();
   object=await new Promise<THREE.Group>((resolve,reject)=>{new USDLoader(manager).parse(buffer,'',resolve,reject);});
  }else{
   const loader=new GLTFLoader(manager);draco=new DRACOLoader();draco.setDecoderPath('/decoders/draco/');loader.setDRACOLoader(draco);loader.setMeshoptDecoder(MeshoptDecoder);
   object=(await loader.parseAsync(/\.gltf$/i.test(root.name)?await root.text():await root.arrayBuffer(),'')).scene;
  }
  prepared=prepareCustomObject(object);const mesh=new THREE.Mesh(prepared.geometry,prepared.materials);
  const packed=await new GLTFExporter().parseAsync(mesh,{binary:true,onlyVisible:true}) as ArrayBuffer;
  if(packed.byteLength>LIMIT)throw new Error('展开后的模型超过 60 MB，请简化模型或压缩贴图。');
  const source=await dataURL(packed),surface:CustomSurface={id:'custom-'+crypto.randomUUID(),kind:'custom',name:root.name.replace(/\.(glb|gltf|usdz)$/i,''),source,height:5.4};
  installed.set(surface.id,{...prepared,source});return surface;
 }catch(error){prepared?.geometry.dispose();prepared?.materials.forEach(m=>m.dispose());throw error;}
 finally{draco?.dispose();urls.forEach(url=>URL.revokeObjectURL(url));}
}
