import {useThree} from '@react-three/fiber';
import {applyModelColor} from './modelColor';
import type {ModelColorSettings} from '../core/types';
import {customMaterials} from '../core/customModel';
import { acceleratedRaycast } from 'three-mesh-bvh';
import * as THREE from 'three';
import { marbleMaterial } from './marble';
import {poleDimensions} from '../core/poleDimensions';
import { modelNormal } from '../core/modelSurface';
import { useMemo, useEffect,useRef,type MutableRefObject } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { SurfaceData, Placement } from '../core/types';
import type {PreviewGeometryCache} from './PreviewGeometryCache';
import { metalMaterial, disposeMaterial } from './materials';
import {roadSignMaterials} from './roadSignMaterials';

export function StickerSurface({ surface, modelColor, onHover, onPlace, draggingId, cache }: {
  modelColor?:ModelColorSettings; cache:PreviewGeometryCache; draggingId:MutableRefObject<string|null>; surface: SurfaceData; onHover: (p: Placement | null) => void; onPlace: (p: Placement) => void;
}) {
  const {invalidate,gl}=useThree();
  const geometry = useMemo(() => cache.surface(surface), [surface]);
  const materials=useRef(new Map<string,THREE.MeshStandardMaterial|THREE.MeshStandardMaterial[]>());
  const materialSources=useRef(new Map<string,string>());
  const material=useMemo(()=>{
    const key=surface.kind==='custom'?surface.id:surface.kind==='sign'?`sign:${surface.icon?.id??''}:${surface.iconColor??''}`:surface.kind;
    const cached=materials.current.get(key);if(cached&&(surface.kind!=='custom'||materialSources.current.get(key)===surface.source))return cached;
    if(cached){(Array.isArray(cached)?cached:[cached]).forEach(disposeMaterial);materials.current.delete(key);}
    if(surface.kind==='sign'){for(const [name,value] of materials.current)if(name.startsWith('sign:')){(Array.isArray(value)?value:[value]).forEach(disposeMaterial);materials.current.delete(name);}}
    const value=surface.kind==='custom'?customMaterials(surface):surface.kind==='sign'?roadSignMaterials(surface):surface.kind==='mesh'?marbleMaterial():metalMaterial();
    materials.current.set(key,value);if(surface.kind==='custom')materialSources.current.set(key,surface.source);return value;
  },[surface.id,surface.kind==='custom'?surface.source:undefined,surface.kind==='sign'?surface.icon?.id:undefined,surface.kind==='sign'?surface.iconColor:undefined]);
  useEffect(()=>()=>{materials.current.forEach(value=>(Array.isArray(value)?value:[value]).forEach(disposeMaterial));materials.current.clear();},[]);
  useEffect(()=>{const anisotropy=gl.capabilities.getMaxAnisotropy();for(const m of Array.isArray(material)?material:[material])for(const texture of Object.values(m))if(texture instanceof THREE.Texture&&texture.anisotropy!==anisotropy){texture.anisotropy=anisotropy;texture.needsUpdate=true;}},[material,gl]);
  useEffect(()=>{(Array.isArray(material)?material:[material]).forEach(m=>applyModelColor(m,modelColor));invalidate();},[material,modelColor,invalidate]);

  const hit = (e: ThreeEvent<PointerEvent | MouseEvent>): Placement => {
    // R3F 的事件由 Three.Raycaster 产生。转成 Surface 局部坐标，避免今后旋转模型导致漂移。
    const point = e.object.worldToLocal(e.point.clone());
    if (surface.kind !== 'cylinder' && e.face) return { position: point.toArray() as [number,number,number], normal: modelNormal(point,e.face as THREE.Face,surface).toArray() as [number,number,number] };
    const length = Math.hypot(point.x, point.z);
    // 圆柱用解析法线，避免高细分网格仍有的逐面法线跳动；复杂模型则改用 face.normal。
    return { position: [point.x, point.y, point.z], normal: [point.x / length, 0, point.z / length] };
  };
  return <group dispose={null}>
    <mesh name={surface.id} geometry={geometry} material={material} raycast={function(this:THREE.Mesh,ray,hits){if(!draggingId.current)acceleratedRaycast.call(this,ray,hits);}} castShadow receiveShadow
      onPointerDown={e=>e.stopPropagation()}
      onPointerOver={e => { e.stopPropagation(); onHover(hit(e)); }}
      onPointerMove={e => { e.stopPropagation(); onHover(hit(e)); }}
      onPointerOut={() => onHover(null)}
      onClick={e => { e.stopPropagation(); if (e.delta < 5) onPlace(hit(e)); }} />
    {surface.kind === 'cylinder' && <><mesh position={[0, poleDimensions(surface).upper, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material} onPointerDown={e=>e.stopPropagation()}>
      <circleGeometry args={[surface.radius, 192]} />
    </mesh>
    <mesh position={[0, -poleDimensions(surface).lower, 0]} rotation={[Math.PI / 2, 0, 0]} material={material} onPointerDown={e=>e.stopPropagation()}>
      <circleGeometry args={[surface.radius, 192]} />
    </mesh></>}
  </group>;
}
