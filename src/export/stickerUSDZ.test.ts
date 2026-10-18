import { expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { packUsdz } from './usdzExtent';
import { preserveUSDZStickers } from './stickerUSDZ';
const enc=new TextEncoder(), dec=new TextDecoder();
const sticker={objectId:4,geometryId:8,stickerId:'paper'};
const scene='def Xform "Object_4" (\n prepend references = @./geometries/Geometry_8.usda@</Geometry>\n)\n{\n rel material:binding = </Materials/Material_6>\n}';
const packageOf=(model:string)=>packUsdz({'model.usda':enc.encode(model)});
it('贴纸网格或透明通道缺失时阻止生成只有空模型的 USDZ',async()=>{
  await expect(preserveUSDZStickers(packageOf(''),[sticker])).rejects.toThrow('网格未完整保存');
  await expect(preserveUSDZStickers(packageOf(scene),[sticker])).rejects.toThrow('透明通道未完整保存');
  const opacity='float inputs:opacity.connect = </Materials/Material_6/Texture_9_diffuse.outputs:a>';
  await expect(preserveUSDZStickers(packageOf(scene+'\n'+opacity),[sticker])).rejects.toThrow('图片未完整保存');
});
it('无贴纸模型保持材料和纹理，只标记贴纸数量',async()=>{
  const model='string creator = "Three.js USDZExporter"\nfloat inputs:opacity = 1';
  const texture=new Uint8Array([1,2,3]);
  const result=await preserveUSDZStickers(packUsdz({'model.usda':enc.encode(model),'textures/stone.png':texture}),[]);
  const files=unzipSync(result);
  expect(dec.decode(files['model.usda'])).toContain('int stickerCount = 0');
  expect(dec.decode(files['model.usda'])).toContain('float inputs:opacity = 1');
  expect(files['textures/stone.png']).toEqual(texture);
});
