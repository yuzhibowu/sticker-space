import type {FloatingSettings} from './types';
import { useReducer } from 'react';
import type { StickerSceneData, StickerAsset, StickerData, SurfaceData, MotionSettings, LightingSettings, ModelColorSettings } from './types';
import {resizePole} from './poleDimensions';
import {transformSticker} from './editing';
import {normalizedSignText} from './signFont';
import {isModelExample} from './modelExamples';
import {originalModelColor} from './modelColor';
export type SceneAction =
  | { type: 'assets'; assets: StickerAsset[] } | { type: 'place'; sticker: StickerData }
  | { type: 'update'; sticker: StickerData; group?: string } | { type: 'remove'; id: string }
  | { type: 'remove-asset'; id: string }
  | { type: 'surface'; surface: SurfaceData }
  | { type:'loaded-surface'; surface:SurfaceData }
  | { type:'floating'; floating:FloatingSettings; group?:string }
  | { type:'model-tilt'; angle:number; group?:string }
  | { type:'model-color'; modelColor:ModelColorSettings; group?:string }
  | { type:'lighting'; lighting:LightingSettings; group?:string }
  | { type:'motion'; motion:MotionSettings; group?:string }
  | { type:'pole-length'; side:'upper'|'lower'; length:number }
  | { type:'sign-text'; text:string }
  | { type:'sign-style'; style:Partial<Pick<Extract<SurfaceData,{kind:'sign'}>,'font'|'textScale'|'lineSpacing'|'icon'|'iconScale'|'iconRotation'|'iconX'|'iconY'|'iconColor'>>; group?:string }
  | { type: 'clear' } | { type: 'replace' | 'restore'; scene: StickerSceneData }
  | { type: 'view'; view: NonNullable<StickerSceneData['view']> }
  | { type: 'undo' | 'redo' | 'commit' };
export type History = { present: StickerSceneData; past: StickerSceneData[]; future: StickerSceneData[]; group?: string };
const wrap = (scene: StickerSceneData): History => ({ present: scene, past: [], future: [] });

// 大图片字符串在不可变历史之间共享；一次手势只产生一个撤销步骤，历史最多 100 步。
export function historyReducer(previous: History | StickerSceneData, action: SceneAction): History {
  const state = 'present' in previous ? previous : wrap(previous), scene = state.present;
  const keepView = (restored: StickerSceneData) => scene.view && scene.surface.id === restored.surface.id ? { ...restored, view: scene.view } : restored;
  if (action.type === 'commit') return { ...state, group: undefined };
  if (action.type === 'undo') return state.past.length ? { present: keepView(state.past.at(-1)!), past: state.past.slice(0, -1), future: [scene, ...state.future] } : state;
  if (action.type === 'redo') return state.future.length ? { present: keepView(state.future[0]), past: [...state.past, scene].slice(-100), future: state.future.slice(1) } : state;
  if (action.type === 'restore') return wrap(action.scene);
  if (action.type === 'view') return { ...state, present: { ...scene, view: action.view } };
  let next = scene;
  switch (action.type) {
    case 'floating': next={...scene,floating:action.floating};break;
    case 'model-tilt': if(!Number.isFinite(action.angle)||Math.abs(action.angle)>90)return state;next={...scene,modelTilt:action.angle};break;
    case 'model-color': next={...scene,modelColor:action.modelColor};break;
    case 'lighting': next={...scene,lighting:action.lighting};break;
    case 'motion': next={...scene,motion:action.motion};break;
    case 'remove-asset': {
      if(action.id.startsWith('demo-') || !scene.assets.some(a=>a.id===action.id))return state;
      next={...scene,assets:scene.assets.filter(a=>a.id!==action.id),stickers:scene.stickers.filter(s=>s.assetId!==action.id),otherModels:scene.otherModels?.map(w=>({...w,stickers:w.stickers.filter(s=>s.assetId!==action.id)}))};
      break;
    }
    case 'assets': next = { ...scene, assets: [...scene.assets, ...action.assets] }; break;
    case 'place': next = { ...scene, stickers: [...scene.stickers, action.sticker] }; break;
    case 'update': next = { ...scene, stickers: scene.stickers.map(s => s.id === action.sticker.id ? action.sticker : s) }; break;
    case 'remove': next = { ...scene, stickers: scene.stickers.filter(s => s.id !== action.id) }; break;
    case 'loaded-surface': return scene.surface.id===action.surface.id?{...state,present:{...scene,surface:action.surface,modelColor:scene.modelColor??(action.surface.id==='custom-example-peppa-pig'?originalModelColor(action.surface):undefined)}}:state;
    case 'surface': {
      if (scene.surface.id === action.surface.id) return state;
      const saved = scene.otherModels?.find(w => w.surface.id === action.surface.id);
      next = { ...scene, surface: isModelExample(action.surface.id)?action.surface:saved?.surface ?? action.surface, stickers: saved?.stickers ?? [], floating:saved?.floating,modelTilt:saved?.modelTilt,motion:saved?.motion, lighting:saved?.lighting, modelColor:saved?.modelColor??(['custom-example-peppa-pig','custom-example-dalian-bread-bag','custom-example-cargo-container','custom-example-copper-hotpot','custom-example-clay-sofa','road-sign-01','custom-example-sticky-note','custom-example-gourd','custom-example-safety-helmet'].includes(action.surface.id)?originalModelColor(action.surface):undefined), view: saved?.view ?? {position:[0,.18,8.8],target:[0,0,0]}, otherModels: [...(scene.otherModels ?? []).filter(w => w.surface.id !== action.surface.id), {surface:scene.surface,stickers:scene.stickers,view:scene.view,floating:scene.floating,modelTilt:scene.modelTilt,motion:scene.motion,lighting:scene.lighting,modelColor:scene.modelColor}] };
      break;
    }
    case 'pole-length': {
      if((scene.surface.kind==='mesh'||scene.surface.kind==='custom')||!Number.isFinite(action.length))return state;
      const surface=resizePole(scene.surface,action.side,action.length);
      if(surface.height===scene.surface.height&&surface.poleUpper===scene.surface.poleUpper&&surface.poleLower===scene.surface.poleLower)return state;
      const stickers=surface.kind==='cylinder'?scene.stickers.map(sticker=>{
        const moved=transformSticker(sticker,surface,{y:sticker.position[1]});
        return [...moved.position,...moved.scale].every((n,i)=>Math.abs(n-[...sticker.position,...sticker.scale][i])<1e-8)?sticker:moved;
      }):scene.stickers;
      next={...scene,surface,stickers};break;
    }
    case 'sign-style': {
      if(scene.surface.kind!=='sign')return state;
      next={...scene,surface:{...scene.surface,...action.style}};break;
    }
    case 'sign-text': {
      if(scene.surface.kind!=='sign') return state;
      const text=normalizedSignText(action.text);if(text===scene.surface.text)return state;
      next={...scene,surface:{...scene.surface,text}};break;
    }
    case 'clear': next = { ...scene, stickers: [] }; break;
    case 'replace': next = action.scene; break;
  }
  const group = action.type==='pole-length'?`pole-${action.side}`:action.type === 'sign-text' ? 'sign-text' : action.type === 'update' || action.type==='sign-style' || action.type==='motion' || action.type==='lighting' || action.type==='model-color' || action.type==='model-tilt' || action.type==='floating' ? action.group : undefined;
  return { present: next, past: group && state.group === group ? state.past : [...state.past, scene].slice(-100), future: [], group };
}
export function useStickerManager(initial: StickerSceneData) {
  const [value, dispatch] = useReducer(historyReducer, initial, wrap);
  // 兼容已打开旧版本的内存状态，热更新不丢弃作品。
  const state = 'present' in value ? value : wrap(value);
  return [state.present, dispatch, { canUndo: !!state.past.length, canRedo: !!state.future.length }] as const;
}
