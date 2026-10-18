import {beforeAll,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {installSignFont,signFont} from './signFont';
import {roadSignGeometry,roadSignParts} from './roadSign';
import {modelHit} from './modelSurface';
import {makeStickerGeometry} from './geometry';
import {historyReducer} from './StickerManager';
import {parseProject} from './project';
import {ROAD_SIGN,POLE,DAVID,type StickerSceneData} from './types';
beforeAll(()=>installSignFont(new Uint8Array(readFileSync('public/fonts/sign-noto-sc-bold.json.gz'))));
it('中英文立体字具有真实厚度，路牌表面可命中且贴纸不会穿到背面',()=>{
  const surface={...ROAD_SIGN,text:'前方\n慢行'};
  for(const text of ['D','A','E','中','前'])for(const shape of signFont().generateShapes(text,1))expect(Math.abs(THREE.ShapeUtils.area(shape.getPoints()))).toBeGreaterThan(shape.holes.reduce((sum,h)=>sum+Math.abs(THREE.ShapeUtils.area(h.getPoints())),0));
  const parts=roadSignParts(surface);
  const letters=parts.filter(p=>p.name.startsWith('SignLettering'));
  expect(letters).toHaveLength(2);
  for(const part of letters){part.geometry.computeBoundingBox();expect(part.geometry.boundingBox!.max.z-part.geometry.boundingBox!.min.z).toBeGreaterThan(.04);}
  const hit=modelHit(new THREE.Ray(new THREE.Vector3(0,-.9,5),new THREE.Vector3(0,0,-1)),surface)!;
  expect(hit.position[2]).toBeCloseTo(.444,3);expect(hit.normal).toEqual([0,0,1]);
  const g=makeStickerGeometry({id:'sign-sticker',surfaceId:surface.id,assetId:'png',...hit,rotation:[0,0,0],scale:[.7,.4],method:'conform',order:0,placedAt:0},surface);
  expect(g.getAttribute('position').count).toBeGreaterThan(0);g.computeBoundingBox();expect(g.boundingBox!.min.z).toBeGreaterThan(.444);
  const master=roadSignGeometry(surface);expect(master.boundingBox!.max.y-master.boundingBox!.min.y).toBeCloseTo(5.4);expect(master.groups.length).toBe(parts.length);
  g.dispose();parts.forEach(p=>p.geometry.dispose());
});
it('三个模型、各自贴纸和中文文字可切换、撤销并完整保存工程',()=>{
  const initial:StickerSceneData={version:1,surface:POLE,assets:[{id:'png',name:'test',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',width:1,height:1}],stickers:[]};
  let state=historyReducer(initial,{type:'surface',surface:DAVID});state=historyReducer(state,{type:'surface',surface:ROAD_SIGN});
  state=historyReducer(state,{type:'sign-text',text:'前方\n慢行'});state=historyReducer(state,{type:'commit'});
  const hit=modelHit(new THREE.Ray(new THREE.Vector3(0,-.9,5),new THREE.Vector3(0,0,-1)),{...ROAD_SIGN,text:'前方\n慢行'})!;
  state=historyReducer(state,{type:'place',sticker:{id:'sign-sticker',surfaceId:ROAD_SIGN.id,assetId:'png',...hit,rotation:[0,0,0],scale:[.6,.3],method:'conform',order:0,placedAt:0}});
  state=historyReducer(state,{type:'surface',surface:POLE});state=historyReducer(state,{type:'surface',surface:ROAD_SIGN});
  const restored=parseProject(JSON.parse(JSON.stringify(state.present)));
  expect(restored.surface).toEqual({...ROAD_SIGN,text:'前方\n慢行'});expect(restored.stickers).toHaveLength(1);expect(restored.otherModels).toHaveLength(2);
  expect(()=>parseProject({...restored,otherModels:[restored.otherModels![0],restored.otherModels![0]]})).toThrow();
  const edited=historyReducer(restored,{type:'sign-text',text:'创作\n实验室'});expect(historyReducer(edited,{type:'undo'}).present.surface).toEqual(restored.surface);
});
it('整张纸覆盖凸起文字与黑边，跨杆身并保留黄色边缘外的完整 UV',()=>{
  const surface={...ROAD_SIGN,text:'前方\n有烧烤'},model=new THREE.Mesh(roadSignGeometry(surface),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));model.updateMatrixWorld();
  for(const [x,y,w,h] of [[0,.35,1.6,.6],[1.65,0,.7,.7],[0,1.86,.72,.8],[.35,1.75,.8,.8]]){
    const g=makeStickerGeometry({id:'paper',surfaceId:surface.id,assetId:'png',position:[x,y,.444],normal:[0,0,1],rotation:[0,0,0],scale:[w,h],method:'conform',order:2,placedAt:0},surface);
    const uv=g.getAttribute('uv'),p=g.getAttribute('position');
    expect(Math.min(...Array.from({length:uv.count},(_,i)=>uv.getX(i)))).toBe(0);expect(Math.max(...Array.from({length:uv.count},(_,i)=>uv.getX(i)))).toBe(1);
    expect(g.boundingBox!.max.x-g.boundingBox!.min.x).toBeCloseTo(w,5);expect(g.boundingBox!.max.y-g.boundingBox!.min.y).toBeCloseTo(h,5);
    const paper=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));paper.updateMatrixWorld();
    for(let j=0;j<13;j++)for(let i=0;i<13;i++){
      const ray=new THREE.Raycaster(new THREE.Vector3(x+(i/12-.5)*w*.99,y+(j/12-.5)*h*.99,5),new THREE.Vector3(0,0,-1));
      const sheet=ray.intersectObject(paper)[0],hit=ray.intersectObject(model)[0];expect(sheet).toBeTruthy();if(hit)expect(sheet.point.z).toBeGreaterThan(hit.point.z+.001);
    }
    expect(Array.from(p.array).every(Number.isFinite)).toBe(true);g.dispose();paper.material.dispose();
  }model.material.dispose();
});
it('文字放大、行间距互相独立，并随工程保存及撤销',()=>{
  const a=roadSignParts(ROAD_SIGN).filter(p=>p.name.startsWith('SignLettering')),style={...ROAD_SIGN,textScale:1.5,lineSpacing:1.1},b=roadSignParts(style).filter(p=>p.name.startsWith('SignLettering'));
  for(let i=0;i<2;i++){a[i].geometry.computeBoundingBox();b[i].geometry.computeBoundingBox();expect(b[i].geometry.boundingBox!.getSize(new THREE.Vector3()).x/a[i].geometry.boundingBox!.getSize(new THREE.Vector3()).x).toBeCloseTo(1.5);}
  const centers=b.map(p=>p.geometry.boundingBox!.getCenter(new THREE.Vector3()).y);expect(centers[0]-centers[1]).toBeCloseTo(1.1);
  const initial:StickerSceneData={version:1,surface:ROAD_SIGN,assets:[{id:'png',name:'test',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',width:1,height:1}],stickers:[]};
  const state=historyReducer(initial,{type:'sign-style',style:{textScale:1.5,lineSpacing:1.1}});expect(parseProject(JSON.parse(JSON.stringify(state.present))).surface).toEqual(style);expect(historyReducer(state,{type:'undo'}).present.surface).toEqual(ROAD_SIGN);
  expect(()=>parseProject({...initial,surface:{...style,textScale:4}})).toThrow();expect(()=>parseProject({...initial,surface:{...style,lineSpacing:-1}})).toThrow();
  [...a,...b].forEach(p=>p.geometry.dispose());
});
it('缓存的最外层表面支持背面和斜向投影，完整轮廓可用于轻量选中框',async()=>{
  const {orientation}=await import('./geometry'),{paperBoundaryGeometry}=await import('./paperBoundary'),{signHeightField}=await import('./signHeightField');
  const surface={...ROAD_SIGN,text:'TEST'},master=roadSignGeometry(surface),front=signHeightField(master,new THREE.Vector3(0,0,1));
  expect(signHeightField(master,new THREE.Vector3(0,0,1))).toBe(front);expect(signHeightField(roadSignGeometry({...surface,text:'中'}),new THREE.Vector3(0,0,1))).not.toBe(front);
  for(const direction of [[0,0,-1],[.6,0,.8]] as [number,number,number][]){
    const normal=new THREE.Vector3(...direction),position=direction[2]<0?new THREE.Vector3(-.7,.4,.328):new THREE.Vector3(0,.4,.444),rotation=orientation(direction,.2).toArray().slice(0,3) as [number,number,number];
    const g=makeStickerGeometry({id:'paper',surfaceId:surface.id,assetId:'png',position:position.toArray(),normal:direction,rotation,scale:[1,.6],method:'conform',order:0,placedAt:0},surface);
    const model=new THREE.Mesh(master,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),paper=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));model.updateMatrixWorld();paper.updateMatrixWorld();
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    for(let i=0;i<9;i++)for(let j=0;j<9;j++){
      // A fold consumes paper length, so its projected footprint is smaller.
      // Test actual sheet coordinates rather than requiring the old stretched rectangle.
      const uv=g.getAttribute('uv'),vertices=g.getAttribute('position');
      const columns=Math.round(1/uv.getX(1)),rows=vertices.count/(columns+1)-1;
      const k=Math.round(j/8*rows)*(columns+1)+Math.round(i/8*columns);
      const p=g.userData.foldedPaper?new THREE.Vector3().fromBufferAttribute(vertices,k):new THREE.Vector3((i/8-.5)*.99,(j/8-.5)*.59,0).applyQuaternion(q).add(position),ray=new THREE.Raycaster(p.clone().addScaledVector(normal,5),normal.clone().negate());
      const sheet=ray.intersectObject(paper)[0],hit=ray.intersectObject(model)[0];expect(sheet).toBeTruthy();if(hit)expect(sheet.distance).toBeLessThan(hit.distance);
    }
    const border=paperBoundaryGeometry(g);expect(border.getAttribute('position').count).toBeLessThan(g.getAttribute('position').count/3);expect(Array.from(border.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    border.dispose();g.dispose();model.material.dispose();paper.material.dispose();
  }
});
