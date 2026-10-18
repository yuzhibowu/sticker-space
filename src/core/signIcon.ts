import * as THREE from 'three';
import {SVGLoader} from 'three/examples/jsm/loaders/SVGLoader.js';
import type {SignIconAsset} from './types';
const INVALID='SVG 图标需要由填色的路径或基本图形组成；文字和描边请先转为轮廓。';
/** Only vector geometry is imported; SVG markup is never inserted into the page. */
export function parseSignIcon(source:string,name:string):SignIconAsset {
 if(source.length>1024*1024)throw new Error('SVG 文件请控制在 1 MB 以内。');
 const document=new DOMParser().parseFromString(source,'image/svg+xml');
 if(document.querySelector('parsererror')||document.documentElement.localName!=='svg')throw new Error('SVG 文件格式无效。');
 if(document.querySelector('script,foreignObject,image,text,filter,linearGradient,radialGradient,use')||/<!DOCTYPE|<!ENTITY/i.test(source))throw new Error(INVALID);
 const data=new SVGLoader().parse(source),shapes:SignIconAsset['shapes']=[];
 let points=0;
 for(const path of data.paths){
  const style=path.userData?.style;
  if(style?.fill==='none'||Number(style?.fillOpacity??1)===0||Number(style?.opacity??1)===0)continue;
  for(const shape of SVGLoader.createShapes(path)){
   const contour=shape.getPoints(24).map(p=>[p.x,-p.y] as [number,number]);
   const holes=shape.holes.map(hole=>hole.getPoints(24).map(p=>[p.x,-p.y] as [number,number]));
   points+=contour.length+holes.reduce((n,h)=>n+h.length,0);
   if(points>20000||shapes.length>=100)throw new Error('SVG 轮廓过于复杂，请简化后再导入。');
   if(contour.length>=3)shapes.push({contour,holes,color:'#'+path.color.getHexString()});
  }
 }
 if(!shapes.length)throw new Error(INVALID);
 const all=shapes.flatMap(s=>[s.contour,...s.holes]).flat();
 if(all.some(p=>p.some(n=>!Number.isFinite(n))))throw new Error('SVG 轮廓坐标无效。');
 const minX=Math.min(...all.map(p=>p[0])),maxX=Math.max(...all.map(p=>p[0])),minY=Math.min(...all.map(p=>p[1])),maxY=Math.max(...all.map(p=>p[1]));
 const x=(minX+maxX)/2,y=(minY+maxY)/2;
 const radius=Math.max(...all.map(p=>Math.abs(p[0]-x)+Math.abs(p[1]-y)));
 if(radius<1e-8)throw new Error(INVALID);
 for(const shape of shapes)for(const contour of [shape.contour,...shape.holes])for(const p of contour){p[0]=(p[0]-x)*1.5/radius;p[1]=(p[1]-y)*1.5/radius;}
 return {id:crypto.randomUUID(),name:name.slice(0,500),source,shapes};
}
export function iconShape(data:SignIconAsset['shapes'][number]){
 const shape=new THREE.Shape(data.contour.map(p=>new THREE.Vector2(...p)));
 shape.holes=data.holes.map(hole=>new THREE.Path(hole.map(p=>new THREE.Vector2(...p))));return shape;
}
export function validSignIcon(value:unknown):value is SignIconAsset {
 if(!value||typeof value!=='object')return false;
 const icon=value as SignIconAsset;
 if(typeof icon.id!=='string'||!icon.id||icon.id.length>100||typeof icon.name!=='string'||icon.name.length>500||typeof icon.source!=='string'||icon.source.length>1024*1024||!Array.isArray(icon.shapes)||!icon.shapes.length||icon.shapes.length>100)return false;
 let count=0;
 const contour=(v:unknown)=>Array.isArray(v)&&v.length>=3&&v.length<=20000&&v.every(p=>{count++;return Array.isArray(p)&&p.length===2&&p.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1.501);});
 return icon.shapes.every(s=>s&&/^#[0-9a-f]{6}$/i.test(s.color)&&contour(s.contour)&&Array.isArray(s.holes)&&s.holes.length<=100&&s.holes.every(contour))&&count<=20000;
}
