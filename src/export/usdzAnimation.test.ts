import { expect,it } from 'vitest';
import { addUSDZTurntable } from './usdzAnimation';
const model=`#usda 1.0\n(\n\tdefaultPrim = "Root"\n)\ndef Xform "Root" {\n def Scope "Scenes" (kind = "sceneLibrary") {\n def Xform "Scene" {\n\t\ttoken preliminary:anchoring:type = "plane"\n def Xform "Model" {}\n def Xform "Sticker" {}\n }\n }\n}\ndef "Materials" {}`;
it('按周期写完整一圈，模型和贴纸共享父变换，材质不参与旋转',()=>{
  const output=addUSDZTurntable(model,{fps:30,duration:8});
  expect(output).toContain('endTimeCode = 240'); expect(output).toContain('timeCodesPerSecond = 30');
  const block=output.match(/timeSamples = \{([^}]+)\}/)![1];
  const pairs=Array.from(block.matchAll(/(\d+): \(([^)]+)\)/g),m=>[Number(m[1]),...m[2].split(',').map(Number)]);
  expect(pairs).toHaveLength(241);
  for(let frame=0;frame<=240;frame++){
    const [,w,x,y,z]=pairs[frame];
    expect(w*w+x*x+y*y+z*z).toBeCloseTo(1,8);
    expect(-2*Math.atan2(Math.abs(y),w)*180/Math.PI).toBeCloseTo(-360*frame/240,6);
    if(frame>0)expect(pairs[frame-1].slice(1).reduce((dot,q,i)=>dot+q*pairs[frame][i+1],0)).toBeGreaterThan(0);
  }
  expect(pairs[0]).toEqual([0,1,0,0,0]); expect(pairs[240]).toEqual([240,-1,0,0,0]);
  expect(output).toContain('quatf xformOp:orient = (1, 0, 0, 0)');
  expect(output).toContain('uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:orient", "xformOp:scale"]');
  expect(output).not.toContain('xformOp:rotateY');
  expect(output).toContain('kind = "component"');
  expect(output).not.toContain('sceneLibrary');
  expect(output).not.toContain('preliminary:anchoring');
  expect(output).not.toContain('def Xform "Scene"');
  expect(output).not.toContain('def Scope "Scenes"');
  expect(output).toContain('autoPlay = true'); expect(output).toContain('playbackMode = "loop"');
  expect(output.split('def Xform "Root"')[1].split('def Xform "Turntable"')[0]).not.toContain('xformOp');
  expect(output).toContain('def Xform "Model" {}\n def Xform "Sticker" {}');
  expect(output.endsWith('def "Materials" {}')).toBe(true);
});
it('不同周期/帧率仍匀速，拒绝无效参数和重复动画',()=>{
  const output=addUSDZTurntable(model,{fps:24,duration:2.5});
  expect(output).toContain('endTimeCode = 60'); expect(output).toContain('30: (0, 0, 1, 0)'); expect(output).toContain('60: (-1, 0, 0, 0)');
  for(const duration of [0,31,NaN]) expect(()=>addUSDZTurntable(model,{fps:30,duration})).toThrow();
  expect(()=>addUSDZTurntable(output)).toThrow(); expect(()=>addUSDZTurntable('')).toThrow();
});

it('拒绝展开含其他节点的层级，避免丢失模型',()=>{
  expect(()=>addUSDZTurntable(model.replace('def Scope "Scenes"','def Xform "Extra" {}\n def Scope "Scenes"'))).toThrow();
});

it('未导出 AR 锚定属性时仍生成动画，旧路径同步改到动画节点',()=>{
  const noAnchor=model.replace('\t\ttoken preliminary:anchoring:type = "plane"','rel test = </Root/Scenes/Scene/Model>');
  const output=addUSDZTurntable(noAnchor);
  expect(output).toContain('rel test = </Root/Turntable/Model>');
  expect(output).toContain('quatf xformOp:orient.timeSamples');
});
it('spins USDZ around the tilted Z-oriented axis with an off-center pivot',()=>{
 const output=addUSDZTurntable(model,{fps:30,duration:2,tilt:90,pivot:[0,2,0]});
 expect(output).toContain('15: (0.707106781, 0.707106781, 0, 0)');
 expect(output).toContain('float3 xformOp:translate.timeSamples');
 expect(output).toContain('30: (0, 4, 0)');
});
it('bakes floating and rotation into one closed USDZ timeline while keeping floating optional',()=>{
 const output=addUSDZTurntable(model,{fps:30,duration:4,floating:{enabled:true,amount:1},radius:3});
 const translations=output.match(/translate.timeSamples = \{([^}]+)\}/)![1];
 const entries=Array.from(translations.matchAll(/(\d+): \(([^)]+)\)/g),m=>[Number(m[1]),...m[2].split(',').map(Number)]);
 expect(entries[0]).toEqual([0,0,-.141,0]);expect(entries[60]).toEqual([60,0,.141,0]);expect(entries[120].slice(1)).toEqual(entries[0].slice(1));
 const orientations=output.match(/orient.timeSamples = \{([^}]+)\}/)![1],q=Array.from(orientations.matchAll(/(\d+): \(([^)]+)\)/g),m=>m[2].split(',').map(Number));
 q[0].forEach((v,i)=>expect(q[120][i]).toBeCloseTo(-v,8));
 expect(addUSDZTurntable(model,{fps:30,duration:4,floating:{enabled:false,amount:1}})).not.toContain('translate.timeSamples');
});
