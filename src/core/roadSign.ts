import {SIGN_BAND_CENTERS,SIGN_BAND_RADIUS,SIGN_BAND_TUBE} from './signAttachment';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {poleDimensions} from './poleDimensions';
import {customFontRevision} from './customSignFont';
import {iconShape} from './signIcon';
import {signFont} from './signFont';
import type {SurfaceData} from './types';
export type SignSurface=Extract<SurfaceData,{kind:'sign'}>;
export type SignPart={name:string;geometry:THREE.BufferGeometry;material:number};
function roundedSquare(size:number,r:number) {
  const h=size/2,s=new THREE.Shape(); s.moveTo(-h+r,-h); s.lineTo(h-r,-h); s.quadraticCurveTo(h,-h,h,-h+r);s.lineTo(h,h-r);s.quadraticCurveTo(h,h,h-r,h);s.lineTo(-h+r,h);s.quadraticCurveTo(-h,h,-h,h-r);s.lineTo(-h,-h+r);s.quadraticCurveTo(-h,-h,-h+r,-h);return s;
}
function plate(size:number,r:number,z:number,depth:number,hole?:number) {
  const shape=roundedSquare(size,r);
  if(hole) shape.holes.push(new THREE.Path(roundedSquare(hole,Math.max(.025,r-.03)).getPoints(10).reverse()));
  const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.007,bevelThickness:.007,bevelSegments:3,steps:1,curveSegments:12});
  g.rotateZ(Math.PI/4);g.translate(0,0,z);return g;
}
/** All geometry uses the same model coordinates: plate, raised lettering and mounting hardware. */
export function roadSignParts(surface:SignSurface):SignPart[] {
  const parts:SignPart[]=[];
  const add=(name:string,g:THREE.BufferGeometry,material:number)=>{
    // Shared projected UVs keep paint wear in one continuous surface coordinate system.
    if(material===0 || material===2 || material===3) {
      const p=g.getAttribute('position'),uv=new Float32Array(p.count*2);
      for(let i=0;i<p.count;i++){uv[i*2]=(p.getX(i)+2.1)/4.2;uv[i*2+1]=(p.getY(i)+2.1)/4.2;}
      g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    }
    parts.push({name,geometry:g,material});
  };
  const dimensions=poleDimensions(surface),pole=new THREE.CylinderGeometry(.40,.40,dimensions.height,128,Math.max(32,Math.ceil(dimensions.height*6)));pole.translate(0,dimensions.center,0);add('SignMetalPole',pole,1);
  add('SignSteelBack',plate(2.81,.16,.335,.027),3);
  add('SignYellowPlate',plate(2.81,.16,.37,.067),0);
  add('SignRaisedBlackBorder',plate(2.68,.14,.446,.018,2.56),2);
  for(const y of SIGN_BAND_CENTERS) {
    const clamp=new THREE.BoxGeometry(1.24,.20,.10,1,1,1);clamp.translate(0,y,.295);add(`Mount_${y}`,clamp,1);
    const band=new THREE.TorusGeometry(SIGN_BAND_RADIUS,SIGN_BAND_TUBE,8,64,Math.PI*2);band.rotateX(Math.PI/2);band.translate(0,y,0);add(`PoleBand_${y}`,band,1);
    for(const x of [-.51,.51]) {
      const bolt=new THREE.CylinderGeometry(.058,.058,.031,6);bolt.rotateX(Math.PI/2);bolt.translate(x,y,.36);add(`Bolt_${x}_${y}`,bolt,3);
      const washer=new THREE.TorusGeometry(.059,.009,8,24);washer.translate(x,y,.367);add(`Washer_${x}_${y}`,washer,1);
    }
  }
  if(surface.icon){
    surface.icon.shapes.forEach((shape,i)=>{
      const g=new THREE.ExtrudeGeometry(iconShape(shape),{depth:.036+i*.0001,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:3,steps:1,curveSegments:8});
      const scale=surface.iconScale??1;g.scale(scale,scale,1);g.rotateZ(-(surface.iconRotation??0)*Math.PI/180);g.translate(surface.iconX??0,surface.iconY??0,.450);add(`SignIcon_${i}`,g,4+i);
    });
    return parts;
  }
  const lines=surface.text.split('\n'),font=signFont(surface);
  lines.forEach((line,i)=>{
    if(!line.trim()) return;
    const baseY=(lines.length-1)/2*.72-i*.72+.08;
    const y=(lines.length-1)/2*(surface.lineSpacing??.72)-i*(surface.lineSpacing??.72)+.08;
    const g=new THREE.ExtrudeGeometry(font.generateShapes(line,.69),{depth:.036,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:3,curveSegments:8,steps:1});
    g.computeBoundingBox();const box=g.boundingBox!;
    if(box.isEmpty()){g.dispose();return;}
    const width=box.max.x-box.min.x,height=box.max.y-box.min.y;
    const fit=Math.min(1,(3.20-2*(Math.abs(baseY)+.25))/Math.max(width,.01),.53/Math.max(height,.01));
    g.translate(-(box.max.x+box.min.x)/2,-(box.max.y+box.min.y)/2,0);g.scale(fit*(surface.textScale??1),fit*(surface.textScale??1),1);g.translate(0,y,.468);add(`SignLettering_${i}`,g,2);
  });
  return parts;
}
const cache=new Map<string,THREE.BufferGeometry>();
export function roadSignGeometry(surface:SignSurface) {
  const key=JSON.stringify([surface.icon?.id,surface.iconScale,surface.iconRotation,surface.iconX,surface.iconY,surface.text,surface.font?customFontRevision(surface.font):null,surface.textScale,surface.lineSpacing,surface.height,surface.poleUpper,surface.poleLower]);
  let master=cache.get(key);if(master) return master;
  const parts=roadSignParts(surface),geometries=parts.map(p=>p.geometry.index ? p.geometry.toNonIndexed() : p.geometry);
  master=mergeGeometries(geometries,true)!;
  master.groups.forEach((group,i)=>{group.materialIndex=parts[i].material;});
  // Indexed triangles are required by the shared curved sticker projection path.
  master.setIndex(Array.from({length:master.getAttribute('position').count},(_,i)=>i));
  master.computeBoundingBox();master.computeBoundingSphere();
  (master as THREE.BufferGeometry & {boundsTree:MeshBVH}).boundsTree=new MeshBVH(master);
  new Set([...parts.map(p=>p.geometry),...geometries]).forEach(g=>g.dispose());
  cache.set(key,master);
  if(cache.size>6){const oldest=cache.keys().next().value!;cache.get(oldest)!.dispose();cache.delete(oldest);}
  return master;
}
