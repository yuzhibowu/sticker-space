import type {ModelColorSettings} from './types';
export const DEFAULT_MODEL_COLOR:Readonly<ModelColorSettings>=Object.freeze({saturation:1,brightness:1,contrast:1});
export function originalModelColor(surface:{id:string}):ModelColorSettings{
 if(surface.id==='custom-example-peppa-pig')return {saturation:1.18,brightness:.88,contrast:1.10};
 if(surface.id==='custom-example-safety-helmet')return {saturation:1.42,brightness:.61,contrast:.96};
 if(surface.id==='custom-example-gourd')return {saturation:1,brightness:1.16,contrast:1.29};
 if(surface.id==='custom-example-sticky-note')return {saturation:2,brightness:1.22,contrast:1.13};
 if(surface.id==='custom-example-copper-hotpot')return {saturation:.79,brightness:.77,contrast:1};
 if(surface.id==='custom-example-clay-sofa')return {saturation:1.29,brightness:.70,contrast:1.39};
 if(surface.id==='road-sign-01')return {saturation:1.10,brightness:.82,contrast:1.08};
 if(surface.id==='custom-example-cargo-container')return {saturation:1.43,brightness:.79,contrast:1.52};
 return surface.id==='custom-example-dalian-bread-bag'?{saturation:1.44,brightness:1.31,contrast:1}:{...DEFAULT_MODEL_COLOR};
}
export const MODEL_COLOR_RANGES={saturation:[0,2,.01],brightness:[0,2,.01],contrast:[0,2,.01]} as const;
export function parseModelColor(value:unknown):ModelColorSettings|undefined{
 if(value===undefined)return;
 if(!value||typeof value!=='object')throw new Error('颜色参数无效。');
 const v=value as ModelColorSettings;
 for(const key of Object.keys(MODEL_COLOR_RANGES) as (keyof ModelColorSettings)[])if(typeof v[key]!=='number'||!Number.isFinite(v[key])||v[key]<0||v[key]>2)throw new Error('颜色参数无效。');
 return {saturation:v.saturation,brightness:v.brightness,contrast:v.contrast};
}
