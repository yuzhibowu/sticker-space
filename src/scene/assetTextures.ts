import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { ResourcePool } from '../core/ResourcePool';
import { imageTexture, loadImage, previewImage } from '../core/assets';
import type { StickerAsset } from '../core/types';

const alphaImages = new WeakMap<THREE.Texture, { width: number; height: number; bytes: Uint8ClampedArray }>();
function textureFromImage(image:HTMLImageElement){
  const texture=imageTexture(image,2048),canvas=document.createElement('canvas');
  const ratio=Math.min(1,1024/Math.max(image.width,image.height));
  canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0,canvas.width,canvas.height);
  alphaImages.set(texture,{width:canvas.width,height:canvas.height,bytes:ctx.getImageData(0,0,canvas.width,canvas.height).data});
  return texture;
}
export const assetTextures=new ResourcePool<THREE.Texture>(async source=>textureFromImage(await loadImage(previewImage(source))),texture=>texture.dispose());
// Reuse the already decoded, sharp library image for immediate placement.
const quickTextures=new ResourcePool<THREE.Texture>(async source=>{
 const url=previewImage(source,true),absolute=new URL(url,document.baseURI).href;
 const cached=Array.from(document.images).find(image=>image.complete&&image.naturalWidth>0&&(image.currentSrc||image.src)===absolute);
 return textureFromImage(cached??await loadImage(url));
},texture=>texture.dispose());

export function opaqueAt(texture: THREE.Texture, uv?: THREE.Vector2) {
  const alpha = alphaImages.get(texture); if (!alpha || !uv) return true;
  const x = THREE.MathUtils.clamp(Math.floor(uv.x * alpha.width), 0, alpha.width - 1);
  const y = THREE.MathUtils.clamp(Math.floor((1 - uv.y) * alpha.height), 0, alpha.height - 1);
  return alpha.bytes[(y * alpha.width + x) * 4 + 3] >= 4;
}
export function useAssetTexture(asset:StickerAsset){
 const [state,setState]=useState<{source:string;texture:THREE.Texture}|null>(null);
 useEffect(()=>{
  let full=false;
  const quick=quickTextures.acquire(asset.image,texture=>{if(texture&&!full)setState({source:asset.image,texture});});
  const release=assetTextures.acquire(asset.image,texture=>{if(texture){full=true;setState({source:asset.image,texture});quick();}});
  return()=>{quick();release();};
 },[asset.image]);
 return state?.source===asset.image?state.texture:null;
}
