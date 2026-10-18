import * as THREE from 'three';
import {FontLoader,type Font} from 'three/examples/jsm/loaders/FontLoader.js';
import type {SignFontAsset} from './types';
type Command={type:string;x?:number;y?:number;x1?:number;y1?:number;x2?:number;y2?:number};
type ParsedFont={unitsPerEm:number;ascender:number;descender:number;charToGlyph:(c:string)=>{index:number;advanceWidth:number;path:{commands:Command[]}}};
const parsed=new Map<string,{source:string;font:ParsedFont;revision:number}>();
const subsets=new Map<string,Font>();
let revision=0;
export function customFontRevision(asset:SignFontAsset){const cached=parsed.get(asset.id);if(cached?.source!==asset.source)throw new Error('自定义字体尚未加载');return cached.revision;}
export async function loadCustomSignFont(asset:SignFontAsset) {
  if(parsed.get(asset.id)?.source===asset.source)return;
  const encoded=asset.source.split(',')[1];
  if(!encoded || encoded.length>28*1024*1024)throw new Error('字体文件请小于 20 MB。');
  const binary=atob(encoded),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  const magic=String.fromCharCode(...bytes.subarray(0,4));
  if(!(magic==='OTTO'||magic==='wOFF'||(bytes[0]===0&&bytes[1]===1&&bytes[2]===0&&bytes[3]===0)))throw new Error('请选择 TTF、OTF 或 WOFF 字体文件。');
  const {default:opentype}=await import('three/examples/jsm/libs/opentype.module.js');
  let font:ParsedFont;
  try { font=opentype.parse(bytes.buffer); if(!(font.unitsPerEm>0))throw new Error();font.charToGlyph('A').path.commands; }
  catch {throw new Error('字体文件无法读取，请换一个 TTF、OTF 或 WOFF 文件。');}
  parsed.set(asset.id,{source:asset.source,font,revision:++revision});subsets.clear();
  if(parsed.size>8)parsed.delete(parsed.keys().next().value!);
}
function contours(commands:Command[]) {
  const groups:Command[][]=[];for(const c of commands){if(c.type==='M')groups.push([c]);else if(c.type!=='Z')groups.at(-1)?.push(c);}
  return groups;
}
function outline(commands:Command[],scale:number) {
  const groups=contours(commands);
  // OpenType outlines can use either winding. Three.Font expects clockwise outer contours.
  let biggest=0,area=0;
  for(const group of groups){const path=new THREE.Path();for(const c of group){if(c.type==='M')path.moveTo(c.x!,c.y!);else if(c.type==='L')path.lineTo(c.x!,c.y!);else if(c.type==='Q')path.quadraticCurveTo(c.x1!,c.y1!,c.x!,c.y!);else if(c.type==='C')path.bezierCurveTo(c.x1!,c.y1!,c.x2!,c.y2!,c.x!,c.y!);}
    const a=THREE.ShapeUtils.area(path.getPoints(12));if(Math.abs(a)>biggest){biggest=Math.abs(a);area=a;}}
  const reversed=area>0;
  return groups.flatMap(group=>{
    if(!reversed)return group;
    const result:Command[]=[{type:'M',x:group.at(-1)!.x,y:group.at(-1)!.y}];
    for(let i=group.length-1;i>0;i--){const c=group[i],p=group[i-1];result.push({...c,x:p.x,y:p.y,...(c.type==='C'?{x1:c.x2,y1:c.y2,x2:c.x1,y2:c.y1}:{})});}
    return result;
  }).map(c=>[c.type==='C'?'b':c.type.toLowerCase(),Math.round(c.x!*scale),Math.round(c.y!*scale),...(c.x1===undefined?[]:[Math.round(c.x1*scale),Math.round(c.y1!*scale)]),...(c.x2===undefined?[]:[Math.round(c.x2*scale),Math.round(c.y2!*scale)])].join(' ')).join(' ');
}
export function customSignFont(asset:SignFontAsset,text:string,fallback:Font):Font {
  const source=parsed.get(asset.id);if(!source||source.source!==asset.source)throw new Error('自定义字体尚未加载');
  const key=`${asset.id}:${text}`,cached=subsets.get(key);if(cached)return cached;
  const glyphs:Record<string,{ha:number;x_min:number;x_max:number;o?:string}>={},scale=1000/source.font.unitsPerEm;
  for(const character of new Set([...text,'?',' '])){
    if(character==='\n')continue;
    const glyph=source.font.charToGlyph(character);
    if(glyph.index===0){glyphs[character]=fallback.data.glyphs[character]??fallback.data.glyphs['?'];continue;}
    glyphs[character]={ha:glyph.advanceWidth*scale,x_min:0,x_max:glyph.advanceWidth*scale,o:outline(glyph.path.commands,scale)};
  }
  const font=new FontLoader().parse({...fallback.data,glyphs,resolution:1000,familyName:asset.name});
  subsets.set(key,font);if(subsets.size>12)subsets.delete(subsets.keys().next().value!);return font;
}
export async function importSignFont(file:File):Promise<SignFontAsset> {
  if(file.size>20*1024*1024)throw new Error('字体文件请小于 20 MB。');
  const source=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('字体读取失败。'));reader.readAsDataURL(file);});
  const asset={id:crypto.randomUUID(),name:file.name,source};await loadCustomSignFont(asset);return asset;
}
