import * as THREE from 'three';
import type {SurfaceData} from '../core/types';
import {metalMaterial} from './materials';
import {installSignShadows} from './signShadows';
/** Paint variation describes wear, never fixed illumination. */
function createPaintMaps() {
  const size=1024,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d')!,image=ctx.createImageData(size,size),rough=document.createElement('canvas');rough.width=rough.height=size;
  const rctx=rough.getContext('2d')!,ri=rctx.createImageData(size,size);
  const hash=(x:number,y:number)=>{const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v);};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,n=hash(x,y),broad=hash(Math.floor(x/28),Math.floor(y/28));
    const v=.96+.035*n+.015*broad;
    image.data[i]=242*v;image.data[i+1]=192*v;image.data[i+2]=7+4*n;image.data[i+3]=255;
    ri.data[i]=ri.data[i+1]=ri.data[i+2]=164+35*n;ri.data[i+3]=255;
  }
  ctx.putImageData(image,0,0);rctx.putImageData(ri,0,0);
  for(let i=0;i<170;i++){
    const x=hash(i,2)*size,y=hash(i,4)*size;
    // Tiny nicks and thin shallow scratches, concentrated toward the diamond edge.
    const edge=Math.abs(x-size/2)+Math.abs(y-size/2)>size*.43;
    ctx.strokeStyle=`rgba(55,42,19,${edge?.32:.08})`;ctx.lineWidth=edge?1.0:.45;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(hash(i,9)-.5)*9,y+(hash(i,11)-.5)*16);ctx.stroke();
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
  const roughnessMap=new THREE.CanvasTexture(rough);return {map,roughnessMap};
}
let cachedPaint:ReturnType<typeof createPaintMaps>|undefined;
function paintMaps() {
  cachedPaint??=createPaintMaps();
  const map=cachedPaint.map.clone(),roughnessMap=cachedPaint.roughnessMap.clone();
  map.needsUpdate=roughnessMap.needsUpdate=true;return {map,roughnessMap};
}
export function roadSignMaterials(surface?:Extract<SurfaceData,{kind:'sign'}>) {
  const paint=new THREE.MeshPhysicalMaterial({...paintMaps(),metalness:.12,roughness:.92,clearcoat:.2,clearcoatRoughness:.5});
  paint.name='WeatheredYellowPaint';
  const metal=metalMaterial();metal.name='GalvanizedSignMount';
  const dark=new THREE.MeshPhysicalMaterial({color:'#191d24',metalness:.72,roughness:.48});dark.name='RaisedDarkLettering';
  const back=new THREE.MeshPhysicalMaterial({color:'#56595a',metalness:.85,roughness:.63});back.name='SteelSignBack';
  const icons=(surface?.icon?.shapes??[]).map((shape,i)=>{const material=new THREE.MeshPhysicalMaterial({color:surface?.iconColor??shape.color,metalness:.2,roughness:.6});material.name=`RaisedIcon_${i}`;return material;});
  const materials=[paint,metal,dark,back,...icons];
  materials.forEach(installSignShadows);
  return materials;
}
