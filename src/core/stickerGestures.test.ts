import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {horizontalStickerRoll} from './stickerGestures';
import {orientation,cylinderConformGeometry} from './geometry';
import {POLE} from './types';
describe('统一贴纸手势方向',()=>{
 it('自然滚动右滑顺时针，左滑逆时针，跨180度连续',()=>{
  expect(horizontalStickerRoll(0,-40)).toBe(-10);
  expect(horizontalStickerRoll(0,40)).toBe(10);
  expect(horizontalStickerRoll(-175,-40)).toBe(175);
 });
 it('圆柱展开与普通模型姿态的纸面右方向都向下转',()=>{
  const roll=THREE.MathUtils.degToRad(horizontalStickerRoll(0,-40));
  const rotation=orientation([0,0,1],roll);
  const flat=new THREE.Vector3(1,0,0).applyEuler(rotation);
  const geometry=cylinderConformGeometry({id:'test',assetId:'png',surfaceId:POLE.id,position:[0,0,POLE.radius],normal:[0,0,1],rotation:rotation.toArray().slice(0,3) as [number,number,number],scale:[.2,.2],method:'conform',order:0,placedAt:0},POLE);
  const p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
  let right=-1,left=-1;
  for(let i=0;i<uv.count;i++){if(uv.getY(i)===.5){if(uv.getX(i)===1)right=i;if(uv.getX(i)===0)left=i;}}
  expect(flat.y).toBeLessThan(0);
  expect(p.getY(right)-p.getY(left)).toBeLessThan(0);
  geometry.dispose();
 });
});

it('placement and selected edit stickers share the same vertical size response and bounds',async()=>{
 const {verticalStickerSize}=await import('./stickerGestures');
 const {transformSticker}=await import('./editing');
 const width=verticalStickerSize(.2,40);expect(width).toBeGreaterThan(.2);expect(verticalStickerSize(.2,-40)).toBeLessThan(.2);
 const sticker={id:'edit',assetId:'png',surfaceId:POLE.id,position:[0,0,POLE.radius],normal:[0,0,1],rotation:[0,0,0],scale:[.2,.1],method:'conform',order:0,placedAt:0} as const;
 const edited=transformSticker({...sticker,position:[...sticker.position],normal:[...sticker.normal],rotation:[...sticker.rotation],scale:[...sticker.scale]},POLE,{width});expect(edited.scale[0]).toBeCloseTo(width);expect(edited.scale[0]/edited.scale[1]).toBeCloseTo(2);
 expect(verticalStickerSize(.04,-100)).toBe(.04);expect(verticalStickerSize(4.4,100)).toBe(4.4);
});
