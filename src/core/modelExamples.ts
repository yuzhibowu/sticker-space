import {POLE,type SurfaceData} from './types';
import {cacheCustomModelBytes} from './customModel';
import {gunzipSync} from 'fflate';
type CustomSurface=Extract<SurfaceData,{kind:'custom'}>;
/** Bundled examples are lazy-loaded; selected works embed the GLB for portable backups. */
export const MODEL_EXAMPLES:readonly CustomSurface[]=[];
export const RETIRED_MODEL_IDS=new Set(['custom-example-vintage-cola','custom-example-wet-floor-sign','custom-example-wood-plank','custom-example-medieval-shield','custom-example-lucky-cat','custom-example-temari','custom-example-cola-can','custom-example-naruto-frog-wallet','custom-example-rosetta-stone']);
export const isModelExample=(id:string)=>RETIRED_MODEL_IDS.has(id)||MODEL_EXAMPLES.some(s=>s.id===id);
const bundledSources=new Map<string,Promise<string>>();
export async function loadModelExample(surface:CustomSurface):Promise<CustomSurface>{
 const url=surface.source+'.gz?v='+ (surface.id==='custom-example-dalian-bread-bag'?'bag-color-4':surface.id==='custom-example-barbute-helmet'?'helmet-detail-4':surface.id==='custom-example-copper-hotpot'?'copper-usdz-7':surface.id==='custom-example-sticky-note'?'sticky-yellow-2':surface.id==='custom-example-hongbaolai-soda'?'hongbaolai-compatible-6':surface.id==='custom-example-egg-bacon-muffin'?'muffin-fast-4':['custom-example-peppa-pig','custom-example-egg'].includes(surface.id)?'refined-4':'prepared-3');let source=bundledSources.get(url);
 if(!source){source=(async()=>{
  const response=await fetch(url,{cache:'force-cache',signal:AbortSignal.timeout(45000)});if(!response.ok)throw new Error('案例模型加载失败，请重试。');
  let buffer=await response.arrayBuffer(),bytes=new Uint8Array(buffer);
  if(bytes[0]===0x1f&&bytes[1]===0x8b){buffer=typeof DecompressionStream==='undefined'?gunzipSync(bytes).buffer as ArrayBuffer:await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();bytes=new Uint8Array(buffer);}
  if(bytes.length>60*1024*1024||bytes.length<12||bytes[0]!==0x67||bytes[1]!==0x6c||bytes[2]!==0x54||bytes[3]!==0x46)throw new Error('案例模型数据无效。');
  // Native blob conversion avoids constructing and joining a giant binary string.
  let embedded:string;
  if(typeof FileReader!=='undefined')embedded=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as string);reader.onerror=()=>reject(new Error('案例模型读取失败，请重试。'));reader.readAsDataURL(new Blob([buffer],{type:'model/gltf-binary'}));});
  else{let binary='';for(let i=0;i<bytes.length;i+=65536)binary+=String.fromCharCode(...bytes.subarray(i,i+65536));embedded='data:model/gltf-binary;base64,'+btoa(binary);}
  cacheCustomModelBytes(embedded,buffer);return embedded;
 })();bundledSources.set(url,source);source.catch(()=>bundledSources.delete(url));}
 return {...surface,source:await source};
}

export const DEFAULT_MODEL_EXAMPLE=POLE;
