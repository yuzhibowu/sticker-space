import {beforeAll,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {installSignFont} from './signFont';
beforeAll(()=>installSignFont(new Uint8Array(readFileSync('public/fonts/sign-noto-sc-bold.json.gz'))));
import * as THREE from 'three';
import {ROAD_SIGN,type StickerData} from './types';
import {orientation,makeStickerGeometry,stickerOffset} from './geometry';
import {signPoleSurface,signPolePaperRadius} from './signAttachment';
import {transformSticker} from './editing';
it('old front/back/oblique pole stickers wrap the cylinder without reaching the sign behind it',()=>{
  for(const angle of [0,Math.PI,2.1,-1.3]){
    const normal:[number,number,number]=[Math.sin(angle),0,Math.cos(angle)];
    const data:StickerData={id:'old',surfaceId:ROAD_SIGN.id,assetId:'png',position:[normal[0]*.4,0,normal[2]*.4],normal,rotation:orientation(normal,.15).toArray().slice(0,3) as [number,number,number],scale:[1.1,.6],method:'conform',order:4,placedAt:0};
    const surface=signPoleSurface(ROAD_SIGN,data)!;expect(surface.kind).toBe('cylinder');
    const geometry=makeStickerGeometry(data,ROAD_SIGN),positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
    for(let i=0;i<positions.count;i++)expect(Math.hypot(positions.getX(i),positions.getZ(i))).toBeCloseTo(.4+stickerOffset(4),6);
    expect(Math.min(...Array.from({length:uv.count},(_,i)=>uv.getX(i)))).toBe(0);expect(Math.max(...Array.from({length:uv.count},(_,i)=>uv.getX(i)))).toBe(1);
    const moved=transformSticker(data,surface,{angle:angle+.4,y:1});expect(signPoleSurface(ROAD_SIGN,moved)).not.toBeNull();expect(moved.position[1]).toBe(1);
    geometry.dispose();
  }
});
it('plate, raised lettering and caps keep their own support',()=>{
  for(const position of [[0,0,.444],[.5,0,.48],[0,2.7,.2]] as [number,number,number][])
    expect(signPoleSurface(ROAD_SIGN,{position,normal:[0,0,1]})).toBeNull();
  expect(signPoleSurface(ROAD_SIGN,{position:[0,2.7,.4],normal:[0,1,0]})).toBeNull();
});

it('paper crossing either mounting ring stays outside the ring and returns to the pole',()=>{
 for(const y of [-1.65,1.65]){
  const data:StickerData={id:'band',assetId:'png',surfaceId:ROAD_SIGN.id,position:[0,y,-.4],normal:[0,0,-1],rotation:orientation([0,0,-1],.2).toArray().slice(0,3) as [number,number,number],scale:[.6,.5],method:'conform',order:0,placedAt:0};
  expect(signPoleSurface(ROAD_SIGN,{position:[0,y,-.437],normal:[0,0,-1]})).not.toBeNull();
  const g=makeStickerGeometry(data,ROAD_SIGN),p=g.getAttribute('position');
  let raised=0;
  for(let i=0;i<p.count;i++){const yy=p.getY(i),r=Math.hypot(p.getX(i),p.getZ(i));expect(r).toBeGreaterThanOrEqual(signPolePaperRadius(yy)+stickerOffset(0)-1e-6);if(Math.abs(yy-y)<.004){expect(r).toBeGreaterThan(.437);raised++;}}
  expect(raised).toBeGreaterThan(0);expect(signPolePaperRadius(y+.2)).toBeCloseTo(.4,5);g.dispose();
 }
});

it('paper on the plate back folds toward the pole without stretching its printed grid',()=>{
 for(const x of [-.55,.55])for(const y of [.3,-1.4])for(const roll of [0,.2,.5]){
  const data:StickerData={id:'fold',surfaceId:ROAD_SIGN.id,assetId:'png',position:[x,y,.328],normal:[0,0,-1],rotation:orientation([0,0,-1],roll).toArray().slice(0,3) as [number,number,number],scale:[1,.8],method:'conform',order:0,placedAt:0};
  const g=makeStickerGeometry(data,ROAD_SIGN),p=g.getAttribute('position'),uv=g.getAttribute('uv'),columns=Math.round(1/uv.getX(1)),rows=p.count/(columns+1)-1;
  expect(g.userData.foldedPaper).toBe(true);
  let largest=0;
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
   const k=row*(columns+1)+col,a=new THREE.Vector3().fromBufferAttribute(p,k);
   if(col<columns)largest=Math.max(largest,a.distanceTo(new THREE.Vector3().fromBufferAttribute(p,k+1))/(data.scale[0]/columns));
   if(row<rows)largest=Math.max(largest,a.distanceTo(new THREE.Vector3().fromBufferAttribute(p,k+columns+1))/(data.scale[1]/rows));
  }
  expect(largest).toBeLessThan(1.03);
  expect(uv.getX(0)).toBe(0);expect(uv.getY(0)).toBe(0);expect(uv.getX(uv.count-1)).toBe(1);expect(uv.getY(uv.count-1)).toBe(1);g.dispose();
 }
});
