import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {decodeModel} from './modelDecode';
export type PreparedModel={position:Float32Array;normal:Float32Array;uv:Float32Array;tree:ReturnType<typeof MeshBVH.serialize>};
export function prepareModel(bytes:Uint8Array):PreparedModel{
 const geometry=decodeModel(bytes),tree=new MeshBVH(geometry);
 return {position:geometry.getAttribute('position').array as Float32Array,normal:geometry.getAttribute('normal').array as Float32Array,uv:geometry.getAttribute('uv').array as Float32Array,tree:MeshBVH.serialize(tree,{cloneBuffers:false})};
}
export function restorePreparedModel(data:PreparedModel):THREE.BufferGeometry{
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(data.position,3));
 geometry.setAttribute('normal',new THREE.BufferAttribute(data.normal,3));
 geometry.setAttribute('uv',new THREE.BufferAttribute(data.uv,2));
 (geometry as THREE.BufferGeometry & {boundsTree:MeshBVH}).boundsTree=MeshBVH.deserialize(data.tree,geometry);
 return geometry;
}
