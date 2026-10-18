import * as THREE from 'three';
import type {MeshBVH} from 'three-mesh-bvh';
import type {StickerData} from './types';
/** A continuous sheet above local relief; no independent surface paths can cross. */
export function supportedPaperGeometry(data:StickerData,source:THREE.BufferGeometry,columns:number,rows:number,interactive=false){
 const tree=(source as THREE.BufferGeometry&{boundsTree:MeshBVH}).boundsTree,center=new THREE.Vector3(...data.position),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...data.rotation)),normal=new THREE.Vector3(0,0,1).applyQuaternion(q);
 if(!interactive){columns=Math.max(columns,Math.min(200,Math.ceil(data.scale[0]/.006)));rows=Math.max(rows,Math.min(200,Math.ceil(data.scale[1]/.006)));}
 const stride=columns+1,heights=new Float64Array(stride*(rows+1)),contact=new Uint8Array(stride*(rows+1)),reach=Math.max(...data.scale)*1.5+.1,ray=new THREE.Ray(),point=new THREE.Vector3();
 const sampleStride=columns*2+1,samples=new Float64Array(sampleStride*(rows*2+1)),sampled=new Uint8Array(samples.length);
 const sample=(u:number,v:number)=>{
  const key=Math.round(v*rows*2)*sampleStride+Math.round(u*columns*2);if(sampled[key])return samples[key];
  point.set((u-.5)*data.scale[0],(v-.5)*data.scale[1],0).applyQuaternion(q).add(center);ray.origin.copy(point).addScaledVector(normal,reach);ray.direction.copy(normal).negate();
  const hit=tree.raycastFirst(ray,THREE.DoubleSide);const height=hit&&hit.distance<reach+Math.max(...data.scale)*.25?reach-hit.distance:NaN;sampled[key]=1;samples[key]=height;return height;
 };
 const queue:number[]=[];
 for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){const k=j*stride+i,h=sample(i/columns,j/rows);heights[k]=h;if(Number.isFinite(h)){contact[k]=1;queue.push(k);}}
 // Retain every UV even where the sheet crosses a gap.
 for(let n=0;n<queue.length;n++){const k=queue[n],i=k%stride,j=Math.floor(k/stride);for(const next of [i>0?k-1:-1,i<columns?k+1:-1,j>0?k-stride:-1,j<rows?k+stride:-1])if(next>=0&&!Number.isFinite(heights[next])){heights[next]=heights[k];queue.push(next);}}
 if(!queue.length)heights.fill(0);
 // Test inside each triangle, not just its vertices. Apply only the local
 // penetration deficit; never propagate a raised support across the whole sheet.
 const contactHeights=heights.slice();
 for(let pass=0;pass<2;pass++)for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
  const a=j*stride+i,b=a+1,c=a+stride,d=c+1;let lift=0;
  for(const [du,dv] of [[.5,.5],[.5,0],[.5,1],[0,.5],[1,.5]]){
   const h=sample((i+du)/columns,(j+dv)/rows);if(!Number.isFinite(h))continue;
   const sheet=du>=dv?heights[a]*(1-du)+heights[b]*(du-dv)+heights[d]*dv:heights[a]*(1-dv)+heights[d]*du+heights[c]*(dv-du);
   lift=Math.max(lift,h-sheet);
  }
  if(lift>0)for(const k of [a,b,c,d])heights[k]=Math.min(contactHeights[k]+.006,heights[k]+lift);
 }
 const positions:number[]=[],uv:number[]=[],indices:number[]=[],offset=.00025+Math.min(data.order,50)*.000015;
 for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
  const k=j*stride+i;point.set((i/columns-.5)*data.scale[0],(j/rows-.5)*data.scale[1],heights[k]+offset).applyQuaternion(q).add(center);positions.push(...point.toArray());uv.push(i/columns,j/rows);
  if(i<columns&&j<rows){const a=k,b=k+1,c=k+stride,d=c+1;indices.push(a,b,d,a,d,c);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData.supportedPaper=true;return g;
}

/** A broad front-facing support region distinguishes bumps from a narrow wrapping limb. */
export function hasPaperSupports(data:StickerData,source:THREE.BufferGeometry){
 const tree=(source as THREE.BufferGeometry&{boundsTree:MeshBVH}).boundsTree,q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...data.rotation)),normal=new THREE.Vector3(0,0,1).applyQuaternion(q),center=new THREE.Vector3(...data.position),reach=Math.max(...data.scale)*1.5+.1;let contact=0;
 for(const u of [-.5,0,.5])for(const v of [-.5,0,.5]){const p=new THREE.Vector3(u*data.scale[0],v*data.scale[1],0).applyQuaternion(q).add(center).addScaledVector(normal,reach),hit=tree.raycastFirst(new THREE.Ray(p,normal.clone().negate()),THREE.DoubleSide);if(hit&&hit.distance<reach+Math.max(...data.scale)*.25)contact++;}
 return contact>=5;
}
