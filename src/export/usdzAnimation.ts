import {floatingPose,floatingRotation} from '../core/floating';
import type {FloatingSettings} from '../core/types';
import * as THREE from 'three';
import {modelSpinAxis} from '../core/modelOrbit';
import { DEFAULT_VIDEO, type VideoSettings } from './videoSettings';

export type USDZAnimationSettings = Pick<VideoSettings,'fps'|'duration'> & {enabled?:boolean;direction?:'left'|'right';tilt?:number;pivot?:[number,number,number];floating?:FloatingSettings;radius?:number};

// This adapter accepts only the fixed hierarchy produced by Three's exporter.
// Scan metadata separately: its customData dictionary also contains braces.
function primBody(text:string, declaration:string, from=0) {
  const start=text.indexOf(declaration,from);
  if(start<0)throw new Error(`USDZ 缺少 ${declaration} 节点。`);
  let metadataDepth=0,open=-1;
  for(let i=start+declaration.length;i<text.length;i++){
    if(text[i]==='(')metadataDepth++;
    else if(text[i]===')')metadataDepth--;
    else if(text[i]==='{'&&metadataDepth===0){open=i;break;}
  }
  if(open<0)throw new Error('USDZ 场景节点格式无效。');
  let depth=0;
  for(let i=open;i<text.length;i++){
    if(text[i]==='{')depth++;
    else if(text[i]==='}'&&--depth===0)return {start,open,close:i};
  }
  throw new Error('USDZ 场景节点未闭合。');
}

/** X项目 verified that Freeform freezes animation beneath sceneLibrary. */
function flattenSceneLibrary(text:string,animation:string) {
  const root=primBody(text,'def Xform "Root"');
  const scenes=primBody(text,'def Scope "Scenes"',root.open);
  const scene=primBody(text,'def Xform "Scene"',scenes.open);
  if(!(root.open<scenes.start&&scenes.open<scene.start&&scene.close<scenes.close&&scenes.close<root.close)
    ||text.slice(root.open+1,scenes.start).trim()||text.slice(scenes.close+1,root.close).trim()
    ||text.slice(scenes.open+1,scene.start).trim()||text.slice(scene.close+1,scenes.close).trim())
    throw new Error('USDZ 场景层级已变化，无法安全展开动画。');
  // Keep a common direct child for the model and stickers; cameras stay outside.
  // X项目 disables anchoring for document viewers. Keep AR scene attributes
  // off the animated node, including when adapting an older exporter result.
  const body=text.slice(scene.open+1,scene.close)
    .replace(/^[ \t]*token preliminary:(?:anchoring:type|planeAnchoring:alignment) = "[^"\n]*"[ \t]*\n?/gm,'');
  return `${text.slice(0,root.start)}def Xform "Root" (\n\tkind = "component"\n)\n{\n\tdef Xform "Turntable"\n\t{\n${animation}${body}\n\t}\n}${text.slice(root.close+1)}`
    .replaceAll('/Root/Scenes/Scene','/Root/Turntable');
}

/** Animate the common parent so every curved sticker follows the model exactly. */
export function addUSDZTurntable(model:string, settings:USDZAnimationSettings = DEFAULT_VIDEO) {
  const {fps,duration}=settings;
  if(![24,30,60].includes(fps) || !Number.isFinite(duration) || duration<1 || duration>30) throw new Error('USDZ 旋转周期或帧率无效。');
  const end=Math.round(duration*fps);
  // Match the Apple-compatible motion exporter in the local 几棱体 project:
  // unsuffixed orient, USD quaternion order (w, x, y, z), and continuous signs.
  // Keep the -identity endpoint; flipping it to +identity reverses the last step.
  const number=(value:number)=>Number(value.toFixed(9));
  const axis=modelSpinAxis(settings.tilt),pivot=new THREE.Vector3().fromArray(settings.pivot??[0,0,0]);
  const translations:string[]=[],orientations:number[][]=[];
  const samples=Array.from({length:end+1},(_,frame)=>{
    const halfAngle=(settings.enabled===false?0:1)*((settings.direction??'right')==='right'?1:-1)*Math.PI*frame/end;
    const pose=floatingPose(settings.floating,duration*frame/end,duration,settings.radius??0);
    const q=new THREE.Quaternion().setFromAxisAngle(axis,halfAngle*2);q.premultiply(floatingRotation(pose));
    const offset=pivot.clone().sub(pivot.clone().applyQuaternion(q));offset.y+=pose.y;
    orientations.push([q.w,q.x,q.y,q.z].map(number));
    translations.push(`${frame}: (${offset.toArray().map(number).join(', ')})`);
    return `${frame}: (${orientations[frame].join(', ')})`;
  }).join(', ');
  if(/xformOp:rotateY:turntable|xformOp:orient/.test(model)) throw new Error('USDZ 动画场景结构不完整。');
  const animation=`\t\tfloat3 xformOp:translate = (0, 0, 0)\n\t\tquatf xformOp:orient = (1, 0, 0, 0)\n\t\tquatf xformOp:orient.timeSamples = {${samples}}\n\t\tfloat3 xformOp:scale = (1, 1, 1)\n\t\tuniform token[] xformOpOrder = ["xformOp:translate", "xformOp:orient", "xformOp:scale"]\n\n`;
  const baseAnimation=settings.floating?.enabled?animation.replace('quatf xformOp:orient = (1, 0, 0, 0)',`quatf xformOp:orient = (${orientations[0].join(', ')})`):animation;
  const translated=pivot.lengthSq()>1e-12||settings.floating?.enabled?baseAnimation.replace('float3 xformOp:translate = (0, 0, 0)',`float3 xformOp:translate = (0, 0, 0)\n\t\tfloat3 xformOp:translate.timeSamples = {${translations.join(', ')}}`):baseAnimation;
  // Freeform needs the animated Xform directly under a component root.
  const timing=`\tstartTimeCode = 0\n\tendTimeCode = ${end}\n\ttimeCodesPerSecond = ${fps}\n\tframesPerSecond = ${fps}\n\tautoPlay = true\n\tplaybackMode = "loop"\n`;
  if(!model.includes('\tdefaultPrim = "Root"')) throw new Error('USDZ 缺少动画入口。');
  return flattenSceneLibrary(model,translated).replace('\tdefaultPrim = "Root"',`${timing}\tdefaultPrim = "Root"`);
}
