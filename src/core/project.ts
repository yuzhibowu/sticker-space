import {parseFloating} from './floating';
import {parseModelColor} from './modelColor';
import {MODEL_EXAMPLES,RETIRED_MODEL_IDS} from './modelExamples';
import {parseLighting} from './modelLighting';
import {validSignIcon} from './signIcon';
import {parseMotion} from './motion';
import {poleDimensions,SIGN_PANEL_HALF_HEIGHT} from './poleDimensions';
import { MIN_VIEW_ZOOM, MAX_VIEW_ZOOM } from './viewNavigation';
import type { StickerSceneData } from './types';
import {defaultStickerImages} from './defaultStickerImages';

/** Backups stay self-contained even though startup uses lightweight asset URLs. */
export async function portableProject(scene:StickerSceneData):Promise<StickerSceneData>{
  const assets=await Promise.all(scene.assets.map(async asset=>{
    if(!defaultStickerImages.includes(asset.image))return asset;
    const response=await fetch(asset.image);
    if(!response.ok)throw new Error('工程贴纸资源读取失败，请重试。');
    const bytes=new Uint8Array(await response.arrayBuffer());
    let binary='';for(let i=0;i<bytes.length;i+=65536)binary+=String.fromCharCode(...bytes.subarray(i,i+65536));
    return {...asset,image:'data:image/png;base64,'+btoa(binary)};
  }));
  return {...scene,assets};
}

/** 外部工程先完整检查再整体替换；坏文件不会部分修改当前作品。 */
export function parseProject(value: unknown): StickerSceneData {
  const fail = (): never => { throw new Error('工程格式无效或不受支持，当前作品未修改。'); };
  if (!value || typeof value !== 'object') return fail();
  const s = value as StickerSceneData;
  if(s.modelTilt!==undefined&&(typeof s.modelTilt!=='number'||!Number.isFinite(s.modelTilt)||Math.abs(s.modelTilt)>90))return fail();
  const floating=parseFloating(s.floating),motion=parseMotion(s.motion),lighting=parseLighting(s.lighting),modelColor=parseModelColor(s.modelColor);
  const vector = (v: unknown, n: number) => Array.isArray(v) && v.length === n && v.every(x => typeof x === 'number' && Number.isFinite(x));
  if (s.version !== 1 || !s.surface || typeof s.surface.id !== 'string' || !Number.isFinite(s.surface.height) || s.surface.height <= 0 || s.surface.height > 1000) return fail();
  if (s.surface.kind === 'cylinder') { if (!Number.isFinite(s.surface.radius) || s.surface.radius <= 0 || s.surface.radius > 100) return fail(); }
  else if(s.surface.kind==='sign') {if(s.surface.id!=='road-sign-01'||typeof s.surface.text!=='string'||Array.from(s.surface.text).length>80||s.surface.text.split('\n').length>3||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(s.surface.text))return fail();}
  else if(s.surface.kind==='custom'){if(!s.surface.id.startsWith('custom-')||s.surface.id.length>100||typeof s.surface.name!=='string'||s.surface.name.length>500||typeof s.surface.source!=='string'||s.surface.source.length>82*1024*1024||!/^data:model\/gltf-binary;base64,Z2xURg[A-Za-z0-9+/]+={0,2}$/.test(s.surface.source)||s.surface.height!==5.4)return fail();}
  else if (s.surface.kind !== 'mesh' || s.surface.id !== 'david-01' || s.surface.modelId !== 'david' || s.surface.height !== 5.4) return fail();
  if(s.surface.kind==='cylinder'||s.surface.kind==='sign'){
    const {poleUpper,poleLower}=s.surface;
    if(poleUpper!==undefined||poleLower!==undefined){
      const minimum=s.surface.kind==='sign'?SIGN_PANEL_HALF_HEIGHT:.2;
      if(!Number.isFinite(poleUpper)||!Number.isFinite(poleLower)||poleUpper!<minimum||poleLower!<minimum||poleUpper!>12||poleLower!>12||Math.abs(poleUpper!+poleLower!-s.surface.height)>1e-6)return fail();
    }else if(s.surface.kind==='sign'&&s.surface.height!==5.4)return fail();
  }
  if(s.surface.kind==='sign'){
    const {font,textScale,lineSpacing,icon,iconScale,iconRotation,iconX,iconY,iconColor}=s.surface;
    if(icon!==undefined&&!validSignIcon(icon))return fail();
    for(const [n,min,max] of [[iconScale,.25,3],[iconRotation,-180,180],[iconX,-1.5,1.5],[iconY,-1.5,1.5]] as const)if(n!==undefined&&(!Number.isFinite(n)||n<min||n>max))return fail();
    if(iconColor!==undefined&&(typeof iconColor!=='string'||!/^#[0-9a-f]{6}$/i.test(iconColor)))return fail();
    if(textScale!==undefined&&(!Number.isFinite(textScale)||textScale<.25||textScale>3))return fail();
    if(lineSpacing!==undefined&&(!Number.isFinite(lineSpacing)||lineSpacing<.3||lineSpacing>1.5))return fail();
    if(font&& (typeof font.id!=='string'||!font.id||font.id.length>100||typeof font.name!=='string'||font.name.length>500||typeof font.source!=='string'||font.source.length>28*1024*1024||!/^data:[^,]*;base64,[A-Za-z0-9+/]+={0,2}$/.test(font.source)))return fail();
  }
  if (!Array.isArray(s.assets) || !s.assets.length || s.assets.length > 200 || !Array.isArray(s.stickers) || s.stickers.length > 2000) return fail();
  const assets = new Set<string>(), ids = new Set<string>();
  for (const a of s.assets) {
    if (!a || typeof a.id !== 'string' || assets.has(a.id) || typeof a.name !== 'string' || a.name.length > 500 || typeof a.image !== 'string' || (!/^data:image\/png;base64,iVBORw0KGgo/.test(a.image)&&!(a.id.startsWith('demo-')&&defaultStickerImages.includes(a.image))) || a.image.length > 36 * 1024 * 1024 || !Number.isInteger(a.width) || !Number.isInteger(a.height) || Math.min(a.width, a.height) < 1 || Math.max(a.width, a.height) > (a.id.startsWith('demo-') ? 16384 : 8192)) return fail();
    assets.add(a.id);
  }
  if (s.assets.reduce((sum, a) => sum + a.image.length, 0) > 95 * 1024 * 1024) return fail();
  for (const t of s.stickers) {
    if (!t || typeof t.id !== 'string' || ids.has(t.id) || !assets.has(t.assetId) || t.surfaceId !== s.surface.id || !vector(t.position, 3) || !vector(t.normal, 3) || !vector(t.rotation, 3) || !vector(t.scale, 2) || t.scale.some(x => x <= 0 || x > 100) || !['decal', 'conform'].includes(t.method) || !Number.isInteger(t.order) || t.order < 0 || t.order > 100000 || !Number.isFinite(t.placedAt) || Math.abs(t.placedAt) > 1e9) return fail();
    if (Math.abs(Math.hypot(...t.normal) - 1) > .01 || Math.hypot(...t.position) > 1000) return fail();
    if (s.surface.kind === 'cylinder' && (Math.abs(Math.hypot(t.position[0], t.position[2]) - s.surface.radius) > 0.01 || Math.abs(Math.hypot(...t.normal) - 1) > 0.01 || Math.abs(t.normal[1]) > 0.01 || (t.position[1]>poleDimensions(s.surface).upper || t.position[1]<-poleDimensions(s.surface).lower))) return fail();
    ids.add(t.id);
  }
  if (s.view && (!vector(s.view.position, 3) || !vector(s.view.target, 3) || Math.hypot(...s.view.position) > 1000 || (s.view.zoom !== undefined && (!Number.isFinite(s.view.zoom) || s.view.zoom < MIN_VIEW_ZOOM || s.view.zoom > MAX_VIEW_ZOOM)))) return fail();
let otherModels: StickerSceneData['otherModels'];
  if (s.otherModels !== undefined) {
    if (!Array.isArray(s.otherModels) || s.otherModels.length > 12+MODEL_EXAMPLES.length+RETIRED_MODEL_IDS.size) return fail();
    const models=new Set<string>([s.surface.kind==='custom'?s.surface.id:s.surface.kind]);
    otherModels = s.otherModels.map(w => {
      if (!w || w.surface?.id === s.surface.id || 'otherModels' in w) return fail();
      const key=w.surface.kind==='custom'?w.surface.id:w.surface.kind;if(models.has(key))return fail();models.add(key);
      const parsed = parseProject({version:1,...w,assets:s.assets});
      for (const t of parsed.stickers) { if (ids.has(t.id)) return fail(); ids.add(t.id); }
      return {surface:parsed.surface,stickers:parsed.stickers,view:parsed.view,motion:parsed.motion,lighting:parsed.lighting,floating:parsed.floating,modelTilt:parsed.modelTilt,modelColor:parsed.modelColor};
    });
  }
  const fontBytes=[s.surface,...(otherModels??[]).map(w=>w.surface)].reduce((sum,surface)=>sum+(surface.kind==='sign'?(surface.font?.source.length??0):0),0);
  if(fontBytes+s.assets.reduce((sum,a)=>sum+a.image.length,0)>125*1024*1024)return fail();
  const modelBytes=[s.surface,...(otherModels??[]).map(w=>w.surface)].reduce((sum,surface)=>sum+(surface.kind==='custom'?surface.source.length:0),0);if(modelBytes>125*1024*1024)return fail();
  const lengths=(s.surface.kind==='cylinder'||s.surface.kind==='sign')&&s.surface.poleUpper!==undefined?{poleUpper:s.surface.poleUpper,poleLower:s.surface.poleLower}:{};
  return { version: 1, ...(floating?{floating}:{}), ...(s.modelTilt!==undefined?{modelTilt:s.modelTilt}:{}), ...(modelColor?{modelColor}:{}), ...(lighting?{lighting}:{}), ...(motion?{motion}:{}), surface: s.surface.kind === 'cylinder' ? { id: s.surface.id, kind: s.surface.kind, radius: s.surface.radius, height: s.surface.height,...lengths } : s.surface.kind==='sign' ? {id:'road-sign-01',kind:'sign',height:s.surface.height,...lengths,text:s.surface.text,...(s.surface.icon?{icon:s.surface.icon}:{}),...(s.surface.iconScale!==undefined?{iconScale:s.surface.iconScale}:{}),...(s.surface.iconRotation!==undefined?{iconRotation:s.surface.iconRotation}:{}),...(s.surface.iconX!==undefined?{iconX:s.surface.iconX}:{}),...(s.surface.iconY!==undefined?{iconY:s.surface.iconY}:{}),...(s.surface.iconColor!==undefined?{iconColor:s.surface.iconColor}:{}),...(s.surface.font?{font:{id:s.surface.font.id,name:s.surface.font.name,source:s.surface.font.source}}:{}),...(s.surface.textScale!==undefined?{textScale:s.surface.textScale}:{}),...(s.surface.lineSpacing!==undefined?{lineSpacing:s.surface.lineSpacing}:{})} : s.surface.kind==='custom'?{id:s.surface.id,kind:'custom',height:5.4,name:s.surface.name,source:s.surface.source}:{id:'david-01',kind:'mesh',modelId:'david',height:5.4}, ...(otherModels ? {otherModels} : {}), assets: s.assets.map(a => ({ id: a.id, name: a.name, image: a.image, width: a.width, height: a.height })), stickers: s.stickers.map(t => ({ id: t.id, surfaceId: t.surfaceId, assetId: t.assetId, position: [...t.position], normal: [...t.normal], rotation: [...t.rotation], scale: [...t.scale], method: t.method, order: t.order, placedAt: t.placedAt })), ...(s.view ? { view: { position: [...s.view.position], target: [...s.view.target], ...(s.view.zoom !== undefined ? {zoom:s.view.zoom} : {}) } } : {}) };
}
