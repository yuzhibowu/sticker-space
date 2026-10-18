import {surfaceWrapGeometry} from './surfaceWrap';
import * as THREE from 'three';
import {signPoleSurface,signPolePaperRadius} from './signAttachment';
import {poleDimensions} from './poleDimensions';
import {foldedSignPaper} from './signPaperFold';
import {signHeightField} from './signHeightField';
import { modelGeometry } from './modelSurface';
import { MeshBVH } from 'three-mesh-bvh';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import type { StickerData, SurfaceData, Vec3, StickerMethod } from './types';

export function surfaceGeometry(surface: SurfaceData) {
  // 足够密的纵向/环向细分让旋转后的 Decal 也能贴合，端盖不参与贴纸定位。
  if (surface.kind !== 'cylinder') { const master=modelGeometry(surface), clone=master.clone(); (clone as THREE.BufferGeometry & {boundsTree:MeshBVH}).boundsTree=(master as THREE.BufferGeometry & {boundsTree:MeshBVH}).boundsTree; return clone; }
  const dimensions=poleDimensions(surface),geometry=new THREE.CylinderGeometry(surface.radius,surface.radius,dimensions.height,192,96,true);
  geometry.translate(0,dimensions.center,0);return geometry;
}

export function orientation(normal: Vec3, roll: number): THREE.Euler {
  const z = new THREE.Vector3(...normal).normalize();
  const x = new THREE.Vector3(...(Math.abs(z.y) > .98 ? [0, 0, 1] as const : [0, 1, 0] as const)).cross(z).normalize();
  const y = z.clone().cross(x).normalize();
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll));
  return new THREE.Euler().setFromQuaternion(q);
}

export function resolveMethod(method: StickerMethod, width: number, radius: number) {
  // Decal 的 UV 来自平面投影，大弧面会横向压缩；约 52° 起切换展开曲面。
  return method === 'auto' ? (width / radius > 0.9 ? 'conform' : 'decal') : method;
}

// 判断跨弧面范围时要计入纸面旋转；细长贴纸旋转 90° 后也可能需要 Conform。
export function arcFootprint(scale: [number, number], roll: number) {
  return Math.abs(Math.cos(roll)) * scale[0] + Math.abs(Math.sin(roll)) * scale[1];
}

export function fittedScale(width: number, aspect: number, roll: number, surface: SurfaceData): [number, number] {
  let w = width, h = width / aspect;
  const verticalExtent = Math.abs(Math.sin(roll)) * w + Math.abs(Math.cos(roll)) * h;
  const horizontalExtent = Math.abs(Math.cos(roll)) * w + Math.abs(Math.sin(roll)) * h;
  const factor = Math.min(1, (surface.height - 0.1) / verticalExtent, (surface.kind === 'cylinder' ? surface.radius * Math.PI * 3.2 : surface.kind==='sign' ? 6.4 : surface.kind==='custom'?10.8:3.6) / horizontalExtent);
  w *= factor; h *= factor;
  return [w, h];
}

export function clampPlacementY(y: number, scale: [number, number], roll: number, surface: SurfaceData) {
  if (surface.kind !== 'cylinder') return y;
  const half = (Math.abs(Math.sin(roll)) * scale[0] + Math.abs(Math.cos(roll)) * scale[1]) / 2;
  const {upper,lower}=poleDimensions(surface);
  return THREE.MathUtils.clamp(y,-lower+half+.025,upper-half-.025);
}

export function stickerOffset(order: number) { return 0.0015 + order * 0.00035; }

export function makeStickerGeometry(data: StickerData, surface: SurfaceData, detail:'full'|'interactive'='full'): THREE.BufferGeometry {
  if (surface.kind === 'sign') {
    const pole=signPoleSurface(surface,data);
    return pole ? cylinderConformGeometry(data,pole,signPolePaperRadius,detail) : signPaperGeometry(data,surface,detail);
  }
  if (surface.kind !== 'cylinder') return surfaceWrapGeometry(data,modelGeometry(surface),detail);
  return data.method === 'conform' ? cylinderConformGeometry(data, surface,undefined,detail) : decalGeometry(data, surface,detail);
}

/** A single sheet over the outer envelope of every sign part, including its overhang. */
export function signPaperGeometry(data: StickerData, surface: Extract<SurfaceData,{kind:'sign'}>,detail:'full'|'interactive'='full') {
  const master=modelGeometry(surface);
  const center=new THREE.Vector3(...data.position), q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...data.rotation));
  const normal=new THREE.Vector3(0,0,1).applyQuaternion(q),field=signHeightField(master,normal);
  const density=detail==='interactive'?.12:.016,min=detail==='interactive'?6:12,max=detail==='interactive'?24:240;
  const nx=Math.max(min,Math.min(max,Math.ceil(data.scale[0]/density))), ny=Math.max(min,Math.min(max,Math.ceil(data.scale[1]/density)));
  const stride=nx+1, count=stride*(ny+1), heights=new Float64Array(count).fill(NaN), contact=new Uint8Array(count);
  const point=new THREE.Vector3();
  const sample=(u:number,v:number)=>{
    point.set((u-.5)*data.scale[0],(v-.5)*data.scale[1],0).applyQuaternion(q).add(center);
    return field.sample(point);
  };
  const queue:number[]=[];
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
    const k=j*stride+i, h=sample(i/nx,j/ny);
    if(Number.isFinite(h)){heights[k]=h;contact[k]=1;queue.push(k);}
  }
  // Extend paper across empty space; never clip its UVs to the plate silhouette.
  for(let n=0;n<queue.length;n++){
    const k=queue[n], x=k%stride, y=Math.floor(k/stride);
    for(const next of [x>0?k-1:-1,x<nx?k+1:-1,y>0?k-stride:-1,y<ny?k+stride:-1])
      if(next>=0 && !Number.isFinite(heights[next])){heights[next]=heights[k];queue.push(next);}
  }
  if(!queue.length)heights.fill(0);
  for(let pass=0;pass<24;pass++){
    const previous=heights.slice();
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      const k=j*stride+i;if(contact[k])continue;
      let sum=0,n=0;for(const next of [i>0?k-1:-1,i<nx?k+1:-1,j>0?k-stride:-1,j<ny?k+stride:-1])if(next>=0){sum+=previous[next];n++;}
      heights[k]=sum/n;
    }
  }
  // Support each cell above all sampled relief; triangles cannot sink below a rim or letter.
  const supported=heights.slice();
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    const corners=[j*stride+i,j*stride+i+1,(j+1)*stride+i,(j+1)*stride+i+1];
    let top=Math.max(...corners.map(k=>heights[k]));
    for(const [du,dv] of [[.5,.5],[.5,0],[.5,1],[0,.5],[1,.5]]){
      const h=sample((i+du)/nx,(j+dv)/ny);if(Number.isFinite(h))top=Math.max(top,h);
    }
    for(const k of corners)supported[k]=Math.max(supported[k],top);
  }
  // A small upward-only envelope makes transitions gradual without burying the sheet.
  const slope=.45*Math.max(data.scale[0]/nx,data.scale[1]/ny);
  for(let pass=0;pass<5;pass++){
    const previous=supported.slice();
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      const k=j*stride+i;
      for(const next of [i>0?k-1:-1,i<nx?k+1:-1,j>0?k-stride:-1,j<ny?k+stride:-1])if(next>=0)supported[k]=Math.max(supported[k],previous[next]-slope);
    }
  }
  const folded=foldedSignPaper(supported,nx,ny,...data.scale);
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[],offset=.003+Math.min(data.order,200)*.00035;
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
    const u=i/nx,v=j/ny,k=j*stride+i;
    if(folded)point.fromArray(folded,k*3);else point.set((u-.5)*data.scale[0],(v-.5)*data.scale[1],supported[k]);
    point.z+=offset;point.applyQuaternion(q).add(center);
    positions.push(...point.toArray());uvs.push(u,v);
    if(i<nx&&j<ny)indices.push(k,k+1,k+stride,k+1,k+stride+1,k+stride);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
  geometry.userData.foldedPaper=Boolean(folded);
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

function decalGeometry(data: StickerData, surface: Extract<SurfaceData, {kind:'cylinder'}>,detail:'full'|'interactive'='full') {
  const dimensions=poleDimensions(surface);
  const source=detail==='interactive'?new THREE.CylinderGeometry(surface.radius,surface.radius,dimensions.height,48,24,true):surfaceGeometry(surface);
  if(detail==='interactive')source.translate(0,dimensions.center,0);
  const mesh = new THREE.Mesh(source);
  mesh.updateMatrixWorld(true);
  const depth = Math.min(surface.radius * 0.9, Math.max(0.12, data.scale[0] * 0.45));
  const decal = new DecalGeometry(mesh, new THREE.Vector3(...data.position), new THREE.Euler(...data.rotation), new THREE.Vector3(...data.scale, depth));
  // polygonOffset 不写进 USDZ，所以必须同时做真实的法线微偏移。
  const positions = decal.getAttribute('position');
  const normals = decal.getAttribute('normal');
  const offset = stickerOffset(data.order);
  for (let i = 0; i < positions.count; i++) {
    positions.setXYZ(i, positions.getX(i) + normals.getX(i) * offset, positions.getY(i) + normals.getY(i) * offset, positions.getZ(i) + normals.getZ(i) * offset);
  }
  positions.needsUpdate = true;
  source.dispose();
  decal.computeBoundingBox();
  decal.computeBoundingSphere();
  return decal;
}

export function cylinderConformGeometry(data: StickerData, surface: Extract<SurfaceData, {kind:'cylinder'}>, radialProfile?:(y:number)=>number,detail:'full'|'interactive'='full') {
  const [w, h] = data.scale;
  const center = Math.atan2(data.position[0], data.position[2]);
  const base = orientation(data.normal, 0);
  const q = new THREE.Quaternion().setFromEuler(base).invert().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...data.rotation)));
  const roll = new THREE.Euler().setFromQuaternion(q).z;
  const c = Math.cos(roll), s = Math.sin(roll);
  const nx=detail==='interactive'?Math.max(8,Math.min(32,Math.ceil(w/.1))):Math.max(16,Math.ceil(w/(radialProfile?.008:.025))),ny=detail==='interactive'?Math.max(6,Math.min(24,Math.ceil(h/.12))):Math.max(8,Math.ceil(h/(radialProfile?.008:.04)));
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const radius = surface.radius + stickerOffset(data.order);
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const u = i / nx, v = j / ny;
      const x = (u - 0.5) * w, y = (v - 0.5) * h;
      // 在展开纸面旋转，再映射回圆柱；不是把平面放在圆柱前方。
      const theta = center + (x * c - y * s) / surface.radius;
      const yy = data.position[1] + x * s + y * c;
      const paperRadius=radialProfile ? radialProfile(yy)+stickerOffset(data.order) : radius;
      positions.push(Math.sin(theta) * paperRadius, yy, Math.cos(theta) * paperRadius);
      normals.push(Math.sin(theta), 0, Math.cos(theta));
      uvs.push(u, v);
      if (j < ny && i < nx) {
        const a = j * (nx + 1) + i, b = a + 1, d = a + nx + 1, e = d + 1;
        indices.push(a, b, d, b, e, d);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  if(radialProfile)geometry.computeVertexNormals();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** Clip real surface triangles in the projector volume; never bridge gaps or wrap through the back. */
export function bodyDecalGeometry(data: StickerData,surface?:SurfaceData) {
  const source = modelGeometry(surface), tree = (source as THREE.BufferGeometry & { boundsTree: MeshBVH }).boundsTree;
  const center = new THREE.Vector3(...data.position), normal = new THREE.Vector3(...data.normal).normalize();
  const depth = Math.min(.42, Math.max(.08, Math.max(...data.scale) * .5));
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...data.rotation));
  const inverse = new THREE.Matrix4().compose(center, q, new THREE.Vector3(1,1,1)).invert();
  const half = new THREE.Vector3(data.scale[0]/2, data.scale[1]/2, depth/2);
  const radius = half.length(), sphere = new THREE.Sphere(center, radius);
  const triangles: { points: THREE.Vector3[]; normals: THREE.Vector3[]; key: number }[] = [];
  const attributes = source.getAttribute('normal'), index = source.index!;
  tree.shapecast({
    intersectsBounds: box => box.intersectsSphere(sphere),
    intersectsTriangle: (triangle, i) => {
      if (triangle.getNormal(new THREE.Vector3()).dot(normal) < .25) return false;
      const points = [triangle.a.clone(), triangle.b.clone(), triangle.c.clone()];
      const bounds = new THREE.Box3().setFromPoints(points.map(p => p.clone().applyMatrix4(inverse)));
      if (!bounds.intersectsBox(new THREE.Box3(half.clone().negate(), half))) return false;
      triangles.push({ points, normals: [0,1,2].map(j => new THREE.Vector3().fromBufferAttribute(attributes, index.getX(i*3+j))), key: i });
      return false;
    },
  });
  // Keep only the connected component touching the clicked patch. A nearby arm must not
  // receive a second disconnected copy of a sticker aimed at the torso.
  const vertexKey = (p: THREE.Vector3) => `${Math.round(p.x*1e5)},${Math.round(p.y*1e5)},${Math.round(p.z*1e5)}`;
  const neighbours = new Map<string, number[]>();
  let seed = -1, distance = Infinity;
  triangles.forEach((t,i) => {
    const closest = new THREE.Triangle(...t.points as [THREE.Vector3,THREE.Vector3,THREE.Vector3]).closestPointToPoint(center, new THREE.Vector3()).distanceToSquared(center);
    if (closest < distance) { distance=closest; seed=i; }
    t.points.forEach(p => { const k=vertexKey(p); const list=neighbours.get(k) ?? []; list.push(i); neighbours.set(k,list); });
  });
  const connected = new Set<number>(), queue = seed < 0 ? [] : [seed];
  while (queue.length) { const i = queue.pop()!; if (connected.has(i)) continue; connected.add(i); triangles[i].points.forEach(p => neighbours.get(vertexKey(p))!.forEach(n => { if (!connected.has(n)) queue.push(n); })); }
  const positions:number[]=[], normals:number[]=[];
  connected.forEach(i => triangles[i].points.forEach((p,j) => { positions.push(...p.toArray()); normals.push(...triangles[i].normals[j].toArray()); }));
  const patch = new THREE.BufferGeometry(); patch.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); patch.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  const mesh = new THREE.Mesh(patch); mesh.updateMatrixWorld();
  const decal = new DecalGeometry(mesh,center,new THREE.Euler(...data.rotation),new THREE.Vector3(...data.scale,depth));
  const pos=decal.getAttribute('position'), ns=decal.getAttribute('normal'), offset=.0015 + Math.min(data.order,50)*.00012;
  for (let i=0;i<pos.count;i++) { const n=new THREE.Vector3().fromBufferAttribute(ns,i).normalize(); ns.setXYZ(i,n.x,n.y,n.z); pos.setXYZ(i,pos.getX(i)+n.x*offset,pos.getY(i)+n.y*offset,pos.getZ(i)+n.z*offset); }
  patch.dispose(); decal.computeBoundingBox(); decal.computeBoundingSphere(); return decal;
}
