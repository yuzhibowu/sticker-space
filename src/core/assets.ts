export const RETIRED_DEFAULT_STICKERS=new Set(['demo-pack-11','demo-pack-12']);
import {defaultStickerImages} from './defaultStickerImages';
import * as THREE from 'three';
import type { StickerAsset } from './types';

/** Keep full-resolution PNGs for project/export; decode only display-sized
 * variants in the library and WebGL preview. Imported images remain unchanged. */
export function previewImage(source:string,thumbnail=false):string {
  const index=defaultStickerImages.indexOf(source);
  return index<0?source:`/stickers/previews/v2-${index}-${thumbnail?512:2048}.webp`;
}

export async function importPNG(file: File): Promise<StickerAsset> {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if ([137, 80, 78, 71, 13, 10, 26, 10].some((v, i) => bytes[i] !== v)) throw new Error(`${file.name} 不是有效的 PNG 文件`);
  if (file.size > 25 * 1024 * 1024) throw new Error('单张 PNG 请小于 25 MB');
  const image = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
  });
  const decoded = await loadImage(image);
  if (Math.max(decoded.width, decoded.height) > 8192) throw new Error('PNG 最长边请控制在 8192 像素内');
  return { id: crypto.randomUUID(), name: file.name.replace(/\.png$/i, ''), image, width: decoded.width, height: decoded.height };
}
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('图片解码失败')); img.src = src; });
}
export function imageTexture(image: HTMLImageElement, maxSide = Infinity) {
  let source: HTMLImageElement | HTMLCanvasElement = image;
  const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
  if (ratio < 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio));
    const context = canvas.getContext('2d')!; context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height); source = canvas;
  }
  const texture = new THREE.Texture(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

// 用户提供的默认 PNG，保留原始图像和透明通道。
export function demoAssets():StickerAsset[]{return [{"id": "demo-open-0", "name": "开源示例 1", "image": "data:image/png;base64,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", "width": 256, "height": 256}, {"id": "demo-open-1", "name": "开源示例 2", "image": "data:image/png;base64,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", "width": 256, "height": 256}, {"id": "demo-open-2", "name": "开源示例 3", "image": "data:image/png;base64,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", "width": 256, "height": 256}];}

export function refreshDefaultAssets(scene: import('./types').StickerSceneData) {
 const defaults=demoAssets(),ids=new Set(defaults.map(asset=>asset.id));
 const used=new Set([scene,...(scene.otherModels??[])].flatMap(work=>work.stickers.map(sticker=>sticker.assetId)));
 // Retired artwork stays available to placements in an explicitly opened backup.
 return {...scene,assets:[...defaults,...scene.assets.filter(a=>!a.id.startsWith('demo-')||(!ids.has(a.id)&&used.has(a.id)))]};
}
