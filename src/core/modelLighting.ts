import type {LightingSettings,SurfaceData} from './types';
import stickyNoteAppearance from '../assets/model-examples/sticky-note-appearance.json';
type LightingSurface=Pick<SurfaceData,'kind'>&{id?:string};
/** Parameters and Euler convention mirror the user's 3D project. */
export const DEFAULT_LIGHTING:Readonly<LightingSettings>=Object.freeze({exposure:1,environmentIntensity:.42,keyLightIntensity:.68,fillLightIntensity:.26,shadowIntensity:0,keyAngleX:-35,keyAngle:40,toneMapping:'aces'});
export const REMBRANDT_LIGHTING:Readonly<LightingSettings>=Object.freeze({...DEFAULT_LIGHTING,environmentIntensity:.21,keyLightIntensity:1.02,fillLightIntensity:.07,shadowIntensity:.55,keyAngleX:-45,keyAngle:45});
export const LIGHTING_RANGES={exposure:[0,4,.01],environmentIntensity:[0,3,.01],keyLightIntensity:[0,4,.01],fillLightIntensity:[0,3,.01],shadowIntensity:[0,1,.01],keyAngleX:[-180,180,1],keyAngle:[-180,180,1]} as const;
/** Neutral restores the per-model lighting used before controls were added. */
export function originalLighting(surface:LightingSurface):LightingSettings{
 if(surface.id==='custom-example-maotai')return {profile:'original',toneMappingVersion:1,exposure:.86,environmentIntensity:.98,keyLightIntensity:1.87,fillLightIntensity:.5,shadowIntensity:0,keyAngle:-35,keyAngleX:-43,toneMapping:'aces'};
 if(surface.id==='custom-example-dalian-bread-bag')return {profile:'original',toneMappingVersion:1,exposure:1,environmentIntensity:.98,keyLightIntensity:0,fillLightIntensity:.5,shadowIntensity:0,keyAngleX:-Math.atan2(4,5)*180/Math.PI,keyAngle:Math.asin(-3/Math.sqrt(50))*180/Math.PI,toneMapping:'aces'};
 const stone=surface.kind==='mesh',sign=surface.kind==='sign',x=stone?-4.5:sign?-.65:-3,y=stone?5.5:sign?1:4,z=stone?6:sign?8:5;
 return {...(surface.kind==='custom'?{toneMappingVersion:1 as const}:{}),profile:'original',exposure:surface.id==='custom-example-sticky-note'?stickyNoteAppearance.exposure:1,environmentIntensity:surface.id==='custom-example-lemon'?.94:surface.id==='custom-example-egg'?2.23:surface.id==='custom-example-mjolnir'?1.71:2.86,keyLightIntensity:surface.id==='custom-example-lemon'?2.24:stone?3.15:sign?1.6:1.25,fillLightIntensity:stone?.65:sign?.25:.5,shadowIntensity:stone||sign?.16:0,keyAngleX:-Math.atan2(y,z)*180/Math.PI,keyAngle:Math.asin(x/Math.hypot(x,y,z))*180/Math.PI,toneMapping:surface.kind==='custom'?'aces':'none'};
}
export function resolveLighting(value:LightingSettings|undefined,surface:LightingSurface):LightingSettings{
 const neutral=originalLighting(surface);
 if(!value||lightingMatches(value,DEFAULT_LIGHTING))return neutral;
 if(['custom-example-lemon','custom-example-egg','custom-example-mjolnir'].includes(surface.id??'')&&lightingMatches(value,{...neutral,environmentIntensity:2.86,keyLightIntensity:1.25}))return neutral;
 if(surface.kind==='custom'&&value.toneMappingVersion===undefined&&value.toneMapping==='none')return {...value,toneMapping:'aces',toneMappingVersion:1};
 // Upgrade only the exact previous neutral preset, leaving hand-adjusted lights intact.
 if(surface.kind==='sign'||surface.kind==='mesh'){
  const stone=surface.kind==='mesh',x=stone?-4.5:-3,y=stone?5.5:4,z=stone?6:5;
  const previous={...neutral,keyLightIntensity:stone?3.15:2.2,shadowIntensity:1,keyAngleX:-Math.atan2(y,z)*180/Math.PI,keyAngle:Math.asin(x/Math.hypot(x,y,z))*180/Math.PI};
  if(lightingMatches(value,previous))return neutral;
 }
 return value;
}
export function parseLighting(value:unknown):LightingSettings|undefined{
 if(value===undefined)return;
 if(!value||typeof value!=='object')throw new Error('光照参数无效。');
 const settings=value as LightingSettings;
 for(const [key,[min,max]] of Object.entries(LIGHTING_RANGES)){const n=settings[key as keyof typeof LIGHTING_RANGES];if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw new Error('光照参数无效。');}
 if((settings.toneMappingVersion!==undefined&&settings.toneMappingVersion!==1)||!['aces','linear','none'].includes(settings.toneMapping)||(settings.profile!==undefined&&settings.profile!=='original'))throw new Error('光照参数无效。');
 return {...Object.fromEntries(Object.keys(LIGHTING_RANGES).map(key=>[key,settings[key as keyof typeof LIGHTING_RANGES]])),toneMapping:settings.toneMapping,...(settings.toneMappingVersion?{toneMappingVersion:1}:{}),...(settings.profile?{profile:settings.profile}:{})} as LightingSettings;
}
export function lightingMatches(value:LightingSettings,preset:Readonly<LightingSettings>){return value.profile===preset.profile&&(Object.keys(DEFAULT_LIGHTING) as (keyof LightingSettings)[]).every(key=>value[key]===preset[key]);}
