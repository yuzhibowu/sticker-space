import {beforeAll,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {loadCustomSignFont} from './customSignFont';
import {installSignFont,signFont} from './signFont';
import {parseProject} from './project';
import {ROAD_SIGN} from './types';
beforeAll(()=>installSignFont(new Uint8Array(readFileSync('public/fonts/sign-noto-sc-bold.json.gz'))));
it('实际 OpenType 字体轮廓保留孔洞，缺字回退，字体原文件随工程保存',async()=>{
  const ot=(await import('three/examples/jsm/libs/opentype.module.js')).default as any;
  const path=new ot.Path();path.moveTo(0,0);path.lineTo(600,0);path.lineTo(600,800);path.lineTo(0,800);path.close();path.moveTo(150,150);path.lineTo(150,650);path.lineTo(450,650);path.lineTo(450,150);path.close();
  const font=new ot.Font({familyName:'Test Outline',styleName:'Regular',unitsPerEm:1000,ascender:800,descender:-200,glyphs:[new ot.Glyph({name:'.notdef',advanceWidth:600,path:new ot.Path()}),new ot.Glyph({name:'A',unicode:65,advanceWidth:700,path})]});
  const asset={id:'test-font',name:'test.otf',source:'data:font/otf;base64,'+Buffer.from(font.toArrayBuffer()).toString('base64')};await loadCustomSignFont(asset);
  const surface={...ROAD_SIGN,text:'A中',font:asset},custom=signFont(surface),shapes=custom.generateShapes('A',1);
  expect(shapes).toHaveLength(1);expect(shapes[0].holes).toHaveLength(1);expect(Math.abs(THREE.ShapeUtils.area(shapes[0].getPoints()))).toBeGreaterThan(Math.abs(THREE.ShapeUtils.area(shapes[0].holes[0].getPoints())));
  expect(custom.data.glyphs['中']).toEqual(signFont().data.glyphs['中']);
  const scene={version:1,surface,assets:[{id:'png',name:'test',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',width:1,height:1}],stickers:[]};expect(parseProject(JSON.parse(JSON.stringify(scene))).surface).toEqual(surface);
  await expect(loadCustomSignFont({...asset,id:'bad-font',source:'data:font/otf;base64,AAAA'})).rejects.toThrow();
});

