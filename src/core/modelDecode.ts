import * as THREE from 'three';
import {gunzipSync} from 'fflate';
import {smoothScanNormals} from './smoothScanNormals';
export function decodeModel(downloaded: Uint8Array) {
  const bytes = downloaded[0] === 31 && downloaded[1] === 139 ? gunzipSync(downloaded) : downloaded;
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), count=view.getUint32(0,true), n=view.getUint32(4,true);
  if (count > 500000 || n > 3000000 || bytes.length !== 8+count*22+n*4) throw new Error('扫描模型数据无效');
  const p=new Float32Array(count*3), normals=new Float32Array(count*3), uv=new Float32Array(count*2), indices=new Uint32Array(n);
  for (let i=0;i<p.length;i++) { p[i]=view.getInt32(8+i*4,true)/1e5; normals[i]=view.getInt16(8+count*12+i*2,true)/32767; }
  for (let i=0;i<uv.length;i++) uv[i]=view.getUint16(8+count*18+i*2,true)/65535;
  for (let i=0;i<n;i++) indices[i]=view.getUint32(8+count*22+i*4,true);
  const parsed=new THREE.BufferGeometry(); parsed.setAttribute('position',new THREE.BufferAttribute(p,3)); parsed.setAttribute('normal',new THREE.BufferAttribute(normals,3)); parsed.setAttribute('uv',new THREE.BufferAttribute(uv,2)); parsed.setIndex(new THREE.BufferAttribute(indices,1));
  smoothScanNormals(parsed);
  return parsed;
}
