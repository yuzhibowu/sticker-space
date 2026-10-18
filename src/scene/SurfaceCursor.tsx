import {cursorPress} from './cursorPress';
import {useEffect,useState,useRef} from 'react';
import {useThree,useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import type {StickerData} from '../core/types';
/** 光标和待贴纸共用表面朝向；尖端固定在命中点，且不参与拾取。 */
export function SurfaceCursor({data}:{data:StickerData}){
 const [texture,setTexture]=useState<THREE.Texture|null>(null);
 const {camera,size,invalidate}=useThree(),group=useRef<THREE.Group>(null),feedback=useRef({from:cursorPress.pressed?.8:1,to:cursorPress.pressed?.8:1,elapsed:.12});
 useEffect(()=>{const change=()=>{feedback.current={from:group.current?.scale.x??1,to:cursorPress.pressed?.8:1,elapsed:0};invalidate();};window.addEventListener('cursor-press-change',change);return()=>{window.removeEventListener('cursor-press-change',change);};},[invalidate]);
 useFrame((_,delta)=>{const f=feedback.current;if(!group.current)return;f.elapsed+=Math.min(delta,.05);const t=Math.min(1,f.elapsed/.12);group.current.scale.setScalar(THREE.MathUtils.lerp(f.from,f.to,t*t*(3-2*t)));if(t<1)invalidate();});
 useEffect(()=>{let active=true;const t=new THREE.TextureLoader().load('/cursors/sticker-rounded.svg?v=folio',value=>{value.colorSpace=THREE.SRGBColorSpace;if(active)setTexture(value);});return()=>{active=false;t.dispose();};},[]);
 if(!texture)return null;
 const point=new THREE.Vector3(...data.position),normal=new THREE.Vector3(...data.normal);
 const c=camera as THREE.PerspectiveCamera;
 const width=40/Math.max(1,size.height)*2*camera.position.distanceTo(point)*Math.tan(THREE.MathUtils.degToRad(c.fov)/2)/camera.zoom;
 point.addScaledVector(normal,.03);
 return <group ref={group} position={point} rotation={data.rotation}><mesh position={[.075*width,-.25*width,0]} renderOrder={100001} raycast={()=>{}}><planeGeometry args={[width,width]}/><meshBasicMaterial map={texture} transparent depthTest={false} depthWrite={false} side={THREE.DoubleSide} toneMapped={false}/></mesh></group>;
}
