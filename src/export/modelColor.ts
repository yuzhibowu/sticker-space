import * as THREE from 'three';
import type {ModelColorSettings} from '../core/types';
/** USDZ has no custom shader hooks, so bake adjustments into independent albedo maps. */
export function bakeModelColor(material:THREE.MeshStandardMaterial,settings:ModelColorSettings,cache:Map<string,THREE.Texture>){
 const adjust=(r:number,g:number,b:number)=>{const gray=r*.2126+g*.7152+b*.0722;return [r,g,b].map(c=>THREE.MathUtils.clamp(((gray+(c-gray)*settings.saturation-.5)*settings.contrast+.5)*settings.brightness,0,1));};
 for(const [mapKey,colorKey] of [['map','color'],['emissiveMap','emissive']] as const){
  const color=material[colorKey],map=material[mapKey];if(colorKey==='emissive'&&color.getHex()===0)continue;
  if(!map){const c=color.clone().convertLinearToSRGB();color.setRGB(...adjust(c.r,c.g,c.b) as [number,number,number],THREE.SRGBColorSpace);continue;}
  const key=map.uuid+color.getHexString();let texture=cache.get(key);
  if(!texture){
   const image=map.image as CanvasImageSource&{width:number;height:number};const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),c=new THREE.Color();
   for(let i=0;i<pixels.data.length;i+=4){c.setRGB(pixels.data[i]/255,pixels.data[i+1]/255,pixels.data[i+2]/255,THREE.SRGBColorSpace).multiply(color).convertLinearToSRGB();const rgb=adjust(c.r,c.g,c.b);for(let k=0;k<3;k++)pixels.data[i+k]=Math.round(rgb[k]*255);}
   ctx.putImageData(pixels,0,0);texture=map.clone();texture.image=canvas;texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;cache.set(key,texture);
  }
  material[mapKey]=texture;color.setRGB(1,1,1);
 }
}
