import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { smoothScanNormals } from './smoothScanNormals';

describe('扫描法线去噪', () => {
  it('减弱光斑碎裂，保留顶点和三角形，并统一 UV 分片接缝', () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,0,0,0,-1,0,0,0,-1,0],3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1,0,0,1,0],2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([.2,0,.98,0,0,1,0,0,1,.2,0,.98,0,0,1,0,0,1],3));
    g.setIndex([0,1,2,3,4,5]);
    const positions = g.attributes.position.array.slice(), indices = g.index!.array.slice();
    smoothScanNormals(g);
    expect(g.attributes.position.array).toEqual(positions); expect(g.index!.array).toEqual(indices);
    const n = g.attributes.normal;
    expect(n.getX(0)).toBeLessThan(.15); expect(n.getX(0)).toBeGreaterThan(0);
    expect(new THREE.Vector3().fromBufferAttribute(n,0).distanceTo(new THREE.Vector3().fromBufferAttribute(n,3))).toBe(0);
    for (let i=0;i<n.count;i++) expect(new THREE.Vector3().fromBufferAttribute(n,i).length()).toBeCloseTo(1,6);
  });
});
