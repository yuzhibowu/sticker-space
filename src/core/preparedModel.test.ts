import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {acceleratedRaycast,MeshBVH} from 'three-mesh-bvh';
import {prepareModel,restorePreparedModel} from './preparedModel';
import {decodeModel} from './modelDecode';
describe('background scan transfer',()=>{
 it('keeps geometry, smoothed normals and first-hit queries after transferable roundtrip',()=>{
  const bytes=new Uint8Array(readFileSync('public/models/david.mesh.gz'));
  const prepared=prepareModel(bytes);
  const cloned=structuredClone(prepared,{transfer:[prepared.position.buffer,prepared.normal.buffer,prepared.uv.buffer,prepared.tree.index!.buffer,...prepared.tree.roots]});
  expect(prepared.position.byteLength).toBe(0);
  const restored=restorePreparedModel(cloned),baseline=decodeModel(bytes);
  expect(restored.attributes.position.array).toEqual(baseline.attributes.position.array);
  expect(restored.attributes.normal.array).toEqual(baseline.attributes.normal.array);
  expect(restored.attributes.uv.array).toEqual(baseline.attributes.uv.array);
  expect(restored.index!.count).toBe(baseline.index!.count);
  const mesh=new THREE.Mesh(restored);mesh.raycast=acceleratedRaycast;mesh.updateMatrixWorld();
  const source=new THREE.Mesh(baseline);source.updateMatrixWorld();
  for(const [x,y] of [[0,0],[-.4,.1],[.2,1]])for(const back of [false,true]){
   const ray=new THREE.Raycaster(new THREE.Vector3(x,y,back?-5:5),new THREE.Vector3(0,0,back?1:-1));
   const actual=ray.intersectObject(mesh)[0],expected=ray.intersectObject(source)[0];
   expect(Boolean(actual)).toBe(Boolean(expected));
   if(expected)expect(actual.point.distanceTo(expected.point)).toBeLessThan(1e-6);
  }
  expect((restored as THREE.BufferGeometry & {boundsTree:MeshBVH}).boundsTree).toBeInstanceOf(MeshBVH);
  restored.dispose();baseline.dispose();
 });
 it('rejects invalid scan data before sending a ready result',()=>{
  expect(()=>prepareModel(new Uint8Array(12))).toThrow();
 });
});
