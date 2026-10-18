import {poleDimensions} from './poleDimensions';
import {loadCustomSurface,customModel} from './customModel';
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import type { Placement, SurfaceData, Vec3 } from './types';
import {loadCustomSignFont} from './customSignFont';
import {loadSignFont} from './signFont';
import {roadSignGeometry} from './roadSign';
import {decodeModelInBackground} from './modelDecodeLoader';
export {decodeModel} from './modelDecode';
let geometry: THREE.BufferGeometry | null = import.meta.hot?.data.modelGeometry ?? null, loading: Promise<void> | null = null;
if (import.meta.hot) import.meta.hot.dispose(data => { data.modelGeometry=geometry; });
export async function loadSurface(surface: SurfaceData) {
  if(surface.kind==='custom')return loadCustomSurface(surface);
  if(surface.kind==='sign') {await loadSignFont();if(surface.font)await loadCustomSignFont(surface.font);roadSignGeometry(surface);return;}
  if (surface.kind === 'cylinder' || geometry) return;
  return loading ??= (async () => {
    const response = await fetch('/models/david.mesh.gz');
    if (!response.ok) throw new Error('大卫模型加载失败，请重试。');
    const downloaded = new Uint8Array(await response.arrayBuffer());
    const parsed = await decodeModelInBackground(downloaded);
    installModelGeometry(parsed);
  })().catch(error => { loading = null; throw error; });
}
/** Immutable master; render/export get clones so disposing a snapshot never destroys it. */
export function installModelGeometry(value: THREE.BufferGeometry) {
  geometry = value; value.computeBoundingBox(); value.computeBoundingSphere();
  const indexed=value as THREE.BufferGeometry & {boundsTree?:MeshBVH};
  indexed.boundsTree ??= new MeshBVH(value);
}
export function modelGeometry(surface?:SurfaceData) { if(surface?.kind==='custom')return customModel(surface).geometry; if(surface?.kind==='sign') return roadSignGeometry(surface); if (!geometry) throw new Error('大卫模型尚未加载'); return geometry; }
export function modelNormal(point: THREE.Vector3, face: THREE.Face, surface?:SurfaceData) {
  const source = modelGeometry(surface), pos = source.getAttribute('position'), normals = source.getAttribute('normal');
  const a = new THREE.Vector3().fromBufferAttribute(pos, face.a), b = new THREE.Vector3().fromBufferAttribute(pos, face.b), c = new THREE.Vector3().fromBufferAttribute(pos, face.c);
  const bary = THREE.Triangle.getBarycoord(point, a, b, c, new THREE.Vector3());
  if (!bary) return face.normal.clone().normalize();
  return new THREE.Vector3().fromBufferAttribute(normals, face.a).multiplyScalar(bary.x).addScaledVector(new THREE.Vector3().fromBufferAttribute(normals, face.b), bary.y).addScaledVector(new THREE.Vector3().fromBufferAttribute(normals, face.c), bary.z).normalize();
}
export function modelHit(ray: THREE.Ray,surface?:SurfaceData): Placement | null {
  if(surface?.kind==='cylinder'){
    const {origin:o,direction:d}=ray,a=d.x*d.x+d.z*d.z;
    if(a<1e-12)return null;
    const b=2*(o.x*d.x+o.z*d.z),c=o.x*o.x+o.z*o.z-surface.radius**2,disc=b*b-4*a*c;
    if(disc<0)return null;
    const dimensions=poleDimensions(surface);
    for(const t of [(-b-Math.sqrt(disc))/(2*a),(-b+Math.sqrt(disc))/(2*a)]){
      if(t<0)continue;const point=ray.at(t,new THREE.Vector3());
      if(point.y>dimensions.upper||point.y< -dimensions.lower)continue;
      return {position:point.toArray() as Vec3,normal:[point.x/surface.radius,0,point.z/surface.radius]};
    }
    return null;
  }
  const mesh = new THREE.Mesh(modelGeometry(surface)); mesh.raycast = acceleratedRaycast; mesh.updateMatrixWorld();
  const caster = new THREE.Raycaster(); (caster as THREE.Raycaster & {firstHitOnly:boolean}).firstHitOnly=true; caster.ray.copy(ray);
  const hits: THREE.Intersection[] = []; mesh.raycast(caster, hits);
  const hit = hits[0]; if (!hit?.face) return null;
  return { position: hit.point.toArray() as Vec3, normal: modelNormal(hit.point, hit.face,surface).toArray() as Vec3 };
}
export function modelAnchor(x: number, y: number, back = false) {
  return modelHit(new THREE.Ray(new THREE.Vector3(x, y, back ? -5 : 5), new THREE.Vector3(0, 0, back ? 1 : -1)));
}
