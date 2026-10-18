import {supportedPaperGeometry,hasPaperSupports} from './supportedPaper';
import * as THREE from 'three';
import type {MeshBVH} from 'three-mesh-bvh';
import type {StickerData} from './types';
type Patch={vertices:THREE.Vector3[];faces:[number,number,number][];normals:THREE.Vector3[];adjacent:number[][]};
const patches=new WeakMap<THREE.BufferGeometry,Patch>();
function topology(source:THREE.BufferGeometry){
 const cached=patches.get(source);if(cached)return cached;
 const position=source.getAttribute('position'),normal=source.getAttribute('normal'),index=source.index!;
 const vertices:THREE.Vector3[]=[],normals:THREE.Vector3[]=[],faces:[number,number,number][]=[],adjacent:number[][]=[],edges=new Map<string,{face:number;edge:number}>(),welded=new Map<string,number>(),ids:number[]=[];
 for(let i=0;i<position.count;i++){
  const p=new THREE.Vector3().fromBufferAttribute(position,i),key=p.toArray().map(v=>Math.round(v*1e5)).join(',');
  let id=welded.get(key);if(id===undefined){id=vertices.length;welded.set(key,id);vertices.push(p);}ids.push(id);
  normals.push(new THREE.Vector3().fromBufferAttribute(normal,i));
 }
 // Face vertices retain original indices for smooth normals; adjacency welds position seams.
 const original=Array.from({length:position.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(position,i));
 for(let i=0;i<index.count;i+=3){
  const f:[number,number,number]=[index.getX(i),index.getX(i+1),index.getX(i+2)],face=faces.length;faces.push(f);adjacent.push([-1,-1,-1]);
  for(let edge=0;edge<3;edge++){const a=ids[f[(edge+1)%3]],b=ids[f[(edge+2)%3]],key=a<b?`${a}:${b}`:`${b}:${a}`,other=edges.get(key);if(other){adjacent[face][edge]=other.face;adjacent[other.face][other.edge]=face;}else edges.set(key,{face,edge});}
 }
 const result={vertices:original,faces,normals,adjacent};patches.set(source,result);return result;
}
/** Build the reusable surface walk while the phone model is still loading. */
export function prepareSurfaceWrap(source:THREE.BufferGeometry){topology(source);}
type Sample={point:THREE.Vector3;face:number;direction:THREE.Vector3};
function triangle(patch:Patch,face:number){return new THREE.Triangle(...patch.faces[face].map(i=>patch.vertices[i]) as [THREE.Vector3,THREE.Vector3,THREE.Vector3]);}
function walk(patch:Patch,start:Sample,distance:number):Sample{
 let point=start.point.clone(),face=start.face,direction=start.direction.clone(),remaining=distance;
 for(let step=0;remaining>1e-7&&step<512;step++){
  const t=triangle(patch,face),n=t.getNormal(new THREE.Vector3());direction.addScaledVector(n,-direction.dot(n)).normalize();
  const from=t.getBarycoord(point,new THREE.Vector3()),to=t.getBarycoord(point.clone().addScaledVector(direction,remaining),new THREE.Vector3());
  if(!from||!to)break;
  let fraction=1,edge=-1;
  for(let i=0;i<3;i++){const a=from.getComponent(i),b=to.getComponent(i);if(b< -1e-8){const f=Math.max(0,a/(a-b));if(f<fraction){fraction=f;edge=i;}}}
  point.addScaledVector(direction,remaining*fraction);remaining*=1-fraction;
  if(edge<0)break;
  const next=patch.adjacent[face][edge];if(next<0)break;
  const nextNormal=triangle(patch,next).getNormal(new THREE.Vector3());direction.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(n,nextNormal));face=next;
 }
 return {point,face,direction};
}
/** Walk through connected triangles, carrying paper coordinates around bends and the back. */
export function surfaceWrapGeometry(data:StickerData,source:THREE.BufferGeometry,detail:'full'|'interactive'='full'){
 if(detail==='interactive')return supportedPaperGeometry(data,source,8,8,true);
 const patch=topology(source),tree=(source as THREE.BufferGeometry&{boundsTree:MeshBVH}).boundsTree;
 const hit=tree.closestPointToPoint(new THREE.Vector3(...data.position));
 const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...data.rotation)),x=new THREE.Vector3(1,0,0).applyQuaternion(q),y=new THREE.Vector3(0,1,0).applyQuaternion(q);
 const density=.018,min=16,max=160;
 const columns=Math.max(min,Math.min(max,Math.ceil(data.scale[0]/density))),rows=Math.max(min,Math.min(max,Math.ceil(data.scale[1]/density)));
 // Scans and simplified meshes can contain collapsed faces, especially on thin handles.
 // Preserve the complete sheet with projection when a surface walk has no valid barycentrics.
 const fallback=()=>supportedPaperGeometry(data,source,columns,rows);
 if(!hit)return fallback();
 const positions:number[]=[],normals:number[]=[],uv:number[]=[],indices:number[]=[],offset=.0006+Math.min(data.order,50)*.000015;
 for(let row=0;row<=rows;row++){
  const dy=(row/rows-.5)*data.scale[1],middle=walk(patch,{point:hit.point,face:hit.faceIndex,direction:y.clone().multiplyScalar(Math.sign(dy)||1)},Math.abs(dy));
  const centerNormal=triangle(patch,hit.faceIndex).getNormal(new THREE.Vector3()),rowNormal=triangle(patch,middle.face).getNormal(new THREE.Vector3());
  const rowX=x.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(centerNormal,rowNormal));
  for(let col=0;col<=columns;col++){
   const dx=(col/columns-.5)*data.scale[0],sample=walk(patch,{...middle,direction:rowX.clone().multiplyScalar(Math.sign(dx)||1)},Math.abs(dx)),t=triangle(patch,sample.face),b=t.getBarycoord(sample.point,new THREE.Vector3()),f=patch.faces[sample.face];
   if(!b||![b.x,b.y,b.z,sample.point.x,sample.point.y,sample.point.z].every(Number.isFinite))return fallback();
   const n=new THREE.Vector3().addScaledVector(patch.normals[f[0]],b.x).addScaledVector(patch.normals[f[1]],b.y).addScaledVector(patch.normals[f[2]],b.z).normalize();
   positions.push(...sample.point.clone().addScaledVector(n,offset).toArray());normals.push(...n.toArray());uv.push(col/columns,row/rows);
   if(row<rows&&col<columns){const a=row*(columns+1)+col,b=a+1,c=a+columns+1,d=c+1;indices.push(a,b,d,a,d,c);}
  }
 }
 // Only replace unstable wraps: normal arm/wrist wrapping retains its existing geometry.
 const stride=columns+1,dx=data.scale[0]/columns,dy=data.scale[1]/rows;
 let broken=0,cells=0,rough=0,wrappedBack=0;
 const vertex=(k:number)=>new THREE.Vector3().fromArray(positions,k*3);
 for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
  const k=row*stride+col,a=vertex(k),b=vertex(k+1),c=vertex(k+stride),d=vertex(k+stride+1),ab=b.clone().sub(a),ac=c.clone().sub(a),cross=ab.clone().cross(ac),n=new THREE.Vector3().fromArray(normals,k*3);
  cells++;if(n.dot(new THREE.Vector3(...data.normal))<0)wrappedBack++;
  if(n.distanceTo(new THREE.Vector3().fromArray(normals,(k+1)*3))>.5||n.distanceTo(new THREE.Vector3().fromArray(normals,(k+stride)*3))>.5)rough++;
  if(ab.length()>dx*1.5||ac.length()>dy*1.5||d.distanceTo(b)>dy*1.5||d.distanceTo(c)>dx*1.5||cross.length()<dx*dy*.25||cross.dot(n)<-cross.length()*.25)broken++;
 }
 if(broken>0&&wrappedBack<cells*.05&&(hasPaperSupports(data,source)||rough>cells*.01))return supportedPaperGeometry(data,source,columns,rows);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();return g;
}
