import * as THREE from 'three';
import type {Placement} from './types';

/** A high render order is for the carried overlay; it never grants access through solid models. */
export function stickerHitIsVisible(ray:THREE.Ray,point:THREE.Vector3,firstModelHit:Placement|null){
  return !firstModelHit||ray.origin.distanceTo(point)<=ray.origin.distanceTo(new THREE.Vector3(...firstModelHit.position))+.0001;
}

/** Alpha and model occlusion have already been checked by each sticker's raycast.
 * Match pointer priority to compositing order, even where curved meshes cross. */
export function sortStickerIntersections<T extends THREE.Intersection>(hits:T[]):T[]{
  const stickers=hits.filter(hit=>hit.object.name.startsWith('sticker-'));
  stickers.sort((a,b)=>b.object.renderOrder-a.object.renderOrder||a.distance-b.distance);
  return [...stickers,...hits.filter(hit=>!hit.object.name.startsWith('sticker-'))];
}
