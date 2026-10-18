import * as THREE from 'three';
import { DEFAULT_COMP, FREEFORM_COMP, applyToImageData } from './colorCorrection/color';
import type {CameraView} from '../core/types';
import type { USDZAnimationSettings } from './usdzAnimation';
export type USDZOptions = { correction: 'auto' | 'off'; target: 'keynote' | 'freeform'; appearance?:boolean; animation?:USDZAnimationSettings; framing?:{view?:CameraView;width:number;height:number} };

export async function prepareMaterialForUSDZ(material: THREE.MeshPhysicalMaterial, options: USDZOptions, cache = new Map<THREE.Texture, THREE.Texture>()) {
  // 只接收 buildSceneSnapshot 的导出副本。金属杆没有纸张校准条件，绝不套用纸张补偿。
  // 此处仅处理颜色；Alpha 裁切由 exportUSDZ 统一设置，Auto / Off 都保留原 Alpha。
  if (options.correction === 'off' || !material.map) return;
  const profile = options.target === 'keynote' ? DEFAULT_COMP : FREEFORM_COMP;
  const original = material.map;
  let texture = cache.get(original);
  if (!texture) {
    const image = original.image as HTMLImageElement;
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // 直接复用几棱体的 1130 格实测求解器。它只改 RGB，Alpha 数值逐字节保留。
    applyToImageData(pixels.data, profile);
    ctx.putImageData(pixels, 0, 0);
    texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = original.anisotropy;
    cache.set(original, texture);
    original.dispose();
  }
  material.map = texture;
  material.color.setRGB(1, 1, 1); material.roughness = 0.9; material.metalness = 0; material.clearcoat = 0;
  const lift = profile.calibratedLift ?? 0;
  material.emissive.setRGB(lift, lift, lift);
  material.emissiveMap = lift > 0 ? texture : null; // 必须与 map 同对象，避免双份贴图。
  material.needsUpdate = true;
}
