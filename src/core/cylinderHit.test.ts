import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {modelHit} from './modelSurface';
import {POLE} from './types';
describe('cylinder picking without loading David',()=>{
 it('hits the pole independently of the scanned model',()=>{
  const hit=modelHit(new THREE.Ray(new THREE.Vector3(0,0,5),new THREE.Vector3(0,0,-1)),POLE);
  expect(hit?.position[2]).toBeCloseTo(POLE.radius);expect(hit?.normal[0]).toBeCloseTo(0);expect(hit?.normal[1]).toBe(0);expect(hit?.normal[2]).toBeCloseTo(1);
 });
 it('returns no hit outside the cylinder height or silhouette',()=>{
  expect(modelHit(new THREE.Ray(new THREE.Vector3(3,0,5),new THREE.Vector3(0,0,-1)),POLE)).toBeNull();
  expect(modelHit(new THREE.Ray(new THREE.Vector3(0,100,5),new THREE.Vector3(0,0,-1)),POLE)).toBeNull();
 });
});
