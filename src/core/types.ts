export type Vec3 = [number, number, number];
export type StickerMethod = 'auto' | 'decal' | 'conform';
export type StickerAsset = { id: string; name: string; image: string; width: number; height: number };
// 数据是唯一真相；图片使用原始 data URL，不能把工程只存在 GPU 或 Mesh 上。
export type StickerData = {
  id: string;
  surfaceId: string;
  assetId: string;
  position: Vec3; // Surface 的局部坐标，模型换姿态时不改写。
  normal: Vec3;
  rotation: Vec3;
  scale: [number, number];
  method: Exclude<StickerMethod, 'auto'>;
  order: number;
  placedAt: number; // 统一时间轴中的秒数，离线渲染可指定任意时间。
};
export type SignIconAsset = {id:string;name:string;source:string;shapes:{contour:[number,number][];holes:[number,number][][];color:string}[]};
export type SignFontAsset = {id:string;name:string;source:string};
export type SurfaceData = {id:string;kind:'custom';height:number;name:string;source:string} | { id: string; kind: 'cylinder'; radius: number; height: number; poleUpper?:number; poleLower?:number } | { id: 'david-01'; kind: 'mesh'; modelId: 'david'; height: 5.4 } | { id:'road-sign-01'; kind:'sign'; height:number; poleUpper?:number; poleLower?:number; text:string; font?:SignFontAsset; textScale?:number; lineSpacing?:number; icon?:SignIconAsset; iconScale?:number; iconRotation?:number; iconX?:number; iconY?:number; iconColor?:string };
export type CameraView = { position: Vec3; target: Vec3; zoom?: number };
export type MotionSettings = { mode:'turntable'|'sequence'; enabled?:boolean; direction?:'left'|'right'; intro:number; interval:number; turnDuration:number; hold:number; heroAngle:number; order?:string[] };
export type LightingSettings = {exposure:number;environmentIntensity:number;keyLightIntensity:number;fillLightIntensity:number;shadowIntensity:number;keyAngleX:number;keyAngle:number;toneMapping:'aces'|'linear'|'none';profile?:'original';toneMappingVersion?:1};
export type FloatingSettings = {enabled:boolean;amount:number};
export type ModelColorSettings = {saturation:number;brightness:number;contrast:number};
export type ModelWork = { surface: SurfaceData; stickers: StickerData[]; view?: CameraView; motion?:MotionSettings; lighting?:LightingSettings; floating?:FloatingSettings;modelTilt?:number; modelColor?:ModelColorSettings };
export type StickerSceneData = { version: 1; surface: SurfaceData; assets: StickerAsset[]; stickers: StickerData[]; view?: CameraView; motion?:MotionSettings; lighting?:LightingSettings; floating?:FloatingSettings;modelTilt?:number; modelColor?:ModelColorSettings; otherModels?: ModelWork[] };
export const POLE: Extract<SurfaceData,{kind:'cylinder'}> = { id: 'metal-pole-01', kind: 'cylinder', radius: 0.56, height: 5.4 };
export const DAVID: Extract<SurfaceData,{kind:'mesh'}> = { id: 'david-01', kind: 'mesh', modelId: 'david', height: 5.4 };
export const ROAD_SIGN: Extract<SurfaceData,{kind:'sign'}> = { id:'road-sign-01',kind:'sign',height:5.4,text:'DEAD\nLINE' };
export type Placement = { position: Vec3; normal: Vec3 };
