import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PeelSheet, peelDirectionForPull, screenPeelDirection, peelProgressForTravel, peelDropAction, stepPeelSpring } from './stickerPeel';
import { cylinderConformGeometry } from './geometry';
import { POLE, type StickerData } from './types';

const sticker:StickerData={id:'a',surfaceId:POLE.id,assetId:'png',position:[0,0,.56],normal:[0,0,1],rotation:[0,0,0],scale:[.6,.4],method:'conform',order:0,placedAt:0};
const sheetFor=(data=sticker)=>{
  const base=cylinderConformGeometry(data,POLE);
  return {base,sheet:new PeelSheet(base,data.scale,new THREE.Quaternion().setFromEuler(new THREE.Euler(...data.rotation)),POLE.radius)};
};

describe('peel, carry and drop',()=>{
  it('requires full detachment before moving or deleting; only outside drops delete',()=>{
    expect(peelDropAction(false,false)).toBe('return');expect(peelDropAction(false,true)).toBe('return');
    expect(peelDropAction(true,true)).toBe('place');expect(peelDropAction(true,false)).toBe('remove');
    expect(peelDropAction(true,true,true)).toBe('return');expect(peelDropAction(true,false,true)).toBe('return');
  });
  it('supports every pull direction and requires a deliberate full pull',()=>{
    for(const [x,y,axis,sign] of [[30,0,'u',1],[-30,0,'u',-1],[0,30,'v',1],[0,-30,'v',-1]] as const){
      expect(peelDirectionForPull(new THREE.Vector2(x,y))).toEqual({x:axis==='u'?sign:0,y:axis==='v'?sign:0});
    }
    expect(peelProgressForTravel(3,20)).toBe(0);expect(peelProgressForTravel(10,20)).toBeLessThan(1);
    expect(peelProgressForTravel(50,20)).toBe(1);expect(peelProgressForTravel(100,100)).toBe(1);
  });
  it('keeps 45-degree and arbitrary angles through a rotated or foreshortened screen basis',()=>{
    const diagonal=peelDirectionForPull({x:20,y:20});expect(diagonal.x).toBeCloseTo(Math.SQRT1_2);expect(diagonal.y).toBeCloseTo(Math.SQRT1_2);
    const u=new THREE.Vector2(80,30),v=new THREE.Vector2(10,-140),physical=new THREE.Vector2(2,3),screen=u.clone().multiplyScalar(physical.x).addScaledVector(v,physical.y);
    const actual=screenPeelDirection(screen.x,screen.y,u,v);
    expect(actual.x).toBeCloseTo(2/Math.sqrt(13));expect(actual.y).toBeCloseTo(3/Math.sqrt(13));
  });
  it('returns smoothly without overshoot at different frame rates',()=>{
    for(const dt of [1/30,1/60,1/120]){
      let value=.6,velocity=0,last=value;
      for(let t=0;t<1;t+=dt){const next=stepPeelSpring(value,velocity,0,dt);value=next.value;velocity=next.velocity;expect(value).toBeGreaterThanOrEqual(0);expect(value).toBeLessThanOrEqual(last);last=value;}
      expect(value).toBeLessThan(.0001);
    }
  });
});

describe('one connected paper sheet',()=>{
  it('has no interior seams even when the source decal has duplicated triangle vertices',()=>{
    const base=new THREE.PlaneGeometry(1,.6,16,16).toNonIndexed(),sheet=new PeelSheet(base,[1,.6]);
    const index=sheet.geometry.index!,edges=new Map<string,number>();
    for(let i=0;i<index.count;i+=3)for(let j=0;j<3;j++){
      const a=index.getX(i+j),b=index.getX(i+(j+1)%3),key=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(key,(edges.get(key)??0)+1);
    }
    expect([...edges.values()].filter(count=>count===1)).toHaveLength(64*4);
    expect([...edges.values()].every(count=>count===1||count===2)).toBe(true);
    sheet.update(.7,{axis:'u',sign:1},new THREE.Vector3(0,0,1));
    const p=sheet.geometry.getAttribute('position'),uv=sheet.geometry.getAttribute('uv');
    // Loose rows share one frame; an embossed normal cannot send each strip in its own direction.
    const top=Array.from({length:p.count},(_,i)=>i).filter(i=>uv.getX(i)<.2);
    for(const i of top)expect(p.getZ(i)).toBeGreaterThan(0);
    sheet.dispose();base.dispose();
  });
  it('releases raised surface details into one sheet instead of letting relief normals fan rows into ribbons',()=>{
    const base=new THREE.PlaneGeometry(.6,.4,32,32),p=base.getAttribute('position'),coords=base.getAttribute('uv');
    for(let i=0;i<p.count;i++)p.setZ(i,Math.floor(coords.getY(i)*8)%2*.18);
    base.computeVertexNormals();const sheet=new PeelSheet(base,[.6,.4]);
    sheet.update(.8,{axis:'u',sign:1},new THREE.Vector3(0,0,1));
    const paper=sheet.geometry.getAttribute('position'),uv=sheet.geometry.getAttribute('uv'),heights=new Map<number,number>();
    for(let i=0;i<paper.count;i++)if(uv.getX(i)<.3){
      const u=uv.getX(i),previous=heights.get(u);
      if(previous!==undefined)expect(paper.getZ(i)).toBeCloseTo(previous,5);else heights.set(u,paper.getZ(i));
    }
    expect(heights.size).toBeGreaterThan(10);sheet.dispose();base.dispose();
  });
  it('curls along a diagonal crease while the other corner remains attached',()=>{
    const source=new THREE.PlaneGeometry(1,1,64,64),sheet=new PeelSheet(source,[1,1]);
    sheet.update(.5,{x:Math.SQRT1_2,y:Math.SQRT1_2},new THREE.Vector3(0,0,1));
    const p=sheet.geometry.getAttribute('position'),uv=sheet.geometry.getAttribute('uv');
    for(let i=0;i<p.count;i++){
      if(uv.getX(i)===.25&&uv.getY(i)===.25){expect(p.getX(i)).toBeGreaterThan(-.2);expect(p.getY(i)).toBeGreaterThan(-.2);expect(p.getZ(i)).toBeGreaterThan(.1);}
      if(uv.getX(i)===.75&&uv.getY(i)===.75){expect(p.getX(i)).toBeCloseTo(.25);expect(p.getY(i)).toBeCloseTo(.25);expect(p.getZ(i)).toBe(0);}
    }
    sheet.dispose();source.dispose();
  });
  it('leaves the adhered region on the cylinder without mutating original/export geometry',()=>{
    const {base,sheet}=sheetFor(),original=Array.from(base.getAttribute('position').array);
    sheet.update(.5,{axis:'u',sign:1},new THREE.Vector3(0,0,1));
    const p=sheet.geometry.getAttribute('position'),uv=sheet.geometry.getAttribute('uv');let lifted=0;
    for(let i=0;i<p.count;i++){
      const radius=Math.hypot(p.getX(i),p.getZ(i));expect(radius).toBeGreaterThanOrEqual(POLE.radius-.003);
      if(uv.getX(i)>.55)expect(radius).toBeCloseTo(POLE.radius+.0015,2);
      if(uv.getX(i)<.1&&radius>POLE.radius+.05)lifted++;
    }
    expect(lifted).toBeGreaterThan(0);expect(Array.from(base.getAttribute('position').array)).toEqual(original);
    sheet.dispose();base.dispose();
  });
  it('supports four edges on rotated paper and broad wraps behind the cylinder',()=>{
    for(const data of [{...sticker,rotation:[0,0,.65] as [number,number,number]},{...sticker,scale:[3.8,.8] as [number,number]}]){
      const {base,sheet}=sheetFor(data);
      for(const axis of ['u','v'] as const)for(const sign of [1,-1] as const)for(const progress of [.01,.3,.74,1]){
        sheet.update(progress,{axis,sign},new THREE.Vector3(0,0,1));const p=sheet.geometry.getAttribute('position');
        for(let i=0;i<p.count;i++){expect(Number.isFinite(p.getZ(i))).toBe(true);expect(Math.hypot(p.getX(i),p.getZ(i))).toBeGreaterThanOrEqual(POLE.radius-.004);}
      }
      sheet.dispose();base.dispose();
    }
  });
  it('unfolds into an intact plane and follows a new pointer position after detachment',()=>{
    const {base,sheet}=sheetFor();sheet.update(1,{axis:'v',sign:-1},new THREE.Vector3(0,0,1));
    const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(.2,.3,.1)),center=new THREE.Vector3(2,1,3);
    sheet.carry(center,rotation,1);sheet.carry(center.clone().add(new THREE.Vector3(1,0,0)),rotation,1);
    const p=sheet.geometry.getAttribute('position'),uv=sheet.geometry.getAttribute('uv');
    for(let i=0;i<p.count;i++){
      const expected=new THREE.Vector3((uv.getX(i)-.5)*sticker.scale[0],(uv.getY(i)-.5)*sticker.scale[1],0).applyQuaternion(rotation).add(center).add(new THREE.Vector3(1,0,0));
      expect(new THREE.Vector3().fromBufferAttribute(p,i).distanceTo(expected)).toBeLessThan(1e-6);
    }
    sheet.dispose();base.dispose();
  });
});
