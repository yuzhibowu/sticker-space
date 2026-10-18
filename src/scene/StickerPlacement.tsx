import {stickerCarry,carryProgress} from './stickerCarry';
import { useEffect, useMemo, useRef } from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type { StickerAsset, StickerData, SurfaceData } from '../core/types';
import { useAssetTexture } from './assetTextures';
import { stickerMaterial } from './materials';

export function StickerPlacement({ data, asset, surface,visible=true }: {visible?:boolean; data: StickerData; asset: StickerAsset; surface: SurfaceData }) {
  const map = useAssetTexture(asset);
  const mesh=useRef<THREE.Mesh>(null),fade=useRef({from:0,to:1,elapsed:0});
  const {camera,size,invalidate}=useThree();
  // 放置前是一张沿命中法线悬浮的纸；点击时由 Sticker 接管同一初始姿态并拍向曲面。
  const geometry = useMemo(() => new THREE.PlaneGeometry(...data.scale), [data.scale[0],data.scale[1]]);
  const position = new THREE.Vector3(...data.position).addScaledVector(new THREE.Vector3(...data.normal), 0.025);
  const material = useMemo(() => {
    if (!map) return null;
    const preview=stickerMaterial(map);preview.opacity=0;preview.transparent=true;preview.depthWrite=false;preview.depthTest=false;return preview;
  }, [map]);
  useEffect(()=>{if(material){fade.current={from:material.opacity,to:visible?1:0,elapsed:0};invalidate();}},[visible,material,invalidate]);
  useFrame((_,delta)=>{
    if(material){const f=fade.current;f.elapsed+=Math.min(delta,.05);const t=Math.min(1,f.elapsed/.2),ease=t*t*(3-2*t);material.opacity=THREE.MathUtils.lerp(f.from,f.to,ease);if(t<1)invalidate();}
    if(!mesh.current)return;
    const c=camera as THREE.PerspectiveCamera,point=mesh.current.getWorldPosition(new THREE.Vector3()).applyMatrix4(camera.matrixWorldInverse),depth=Math.max(.1,-point.z);
    const worldPerPixel=2*depth*Math.tan(THREE.MathUtils.degToRad(c.fov/2))/(Math.max(1,size.height)*camera.zoom);
    const from=worldPerPixel*stickerCarry.pixels/Math.max(...data.scale),progress=stickerCarry.inside?carryProgress():1;
    mesh.current.scale.setScalar(THREE.MathUtils.lerp(from,1,progress*stickerCarry.previewScale));if(progress<1)invalidate();
  });
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material?.dispose(), [material]);
  return material ? <mesh ref={mesh} position={position} rotation={data.rotation} geometry={geometry} material={material} renderOrder={100000} raycast={() => {}} /> : null;
}
