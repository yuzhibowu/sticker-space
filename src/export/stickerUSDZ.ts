import { unzipSync } from 'fflate';
import { packUsdz } from './usdzExtent';

export type ExportedSticker = { objectId:number; geometryId:number; stickerId:string };

// 使用独立的线性灰度遮罩，避免不同苹果导入器把彩色 PNG 当透明度颜色读取。
// 颜色图片不变；遮罩逐像素保存原 PNG 的 Alpha。
export async function preserveUSDZStickers(buffer:ArrayBuffer|Uint8Array, stickers:ExportedSticker[]) {
  const files=unzipSync(new Uint8Array(buffer)), decode=new TextDecoder(), encode=new TextEncoder();
  let model=decode.decode(files['model.usda']);
  const masks=new Map<string,string>();
  for (const sticker of stickers) {
    const object=new RegExp(`def Xform "Object_${sticker.objectId}"[\\s\\S]*?\\n\\}`);
    const block=model.match(object)?.[0];
    const material=block?.match(/material:binding = <\/Materials\/(Material_\d+)>/)?.[1];
    if (!block || !material) throw new Error('USDZ 贴纸网格未完整保存，请重新导出。');
    const opacity=new RegExp(`float inputs:opacity.connect = <(/Materials/${material}/Texture_\\d+)_diffuse.outputs:a>`);
    const path=model.match(opacity)?.[1];
    if (!path) throw new Error('USDZ 贴纸透明通道未完整保存，请重新导出。');
    const shaderName=path.split('/').pop()!;
    // 一个材质中的采样器保持自己的 UV 连接；同一图片的遮罩可以共用。
    const sampler=new RegExp(`def Shader "${shaderName}_diffuse"\\s*\\{[^}]*\\}`,'g');
    const source=Array.from(model.matchAll(sampler)).find(match=>match[0].includes(`</Materials/${material}/Transform2d_diffuse.outputs:result>`))?.[0];
    const imagePath=source?.match(/asset inputs:file = @([^@]+)@/)?.[1];
    if (!source || !imagePath || !files[imagePath]) throw new Error('USDZ 贴纸图片未完整保存，请重新导出。');
    let maskPath=masks.get(imagePath);
    if (!maskPath) {
      maskPath=imagePath.replace(/\.png$/, '_alpha.png');
      const bitmap=await createImageBitmap(new Blob([files[imagePath] as unknown as BlobPart],{type:'image/png'}));
      try {
        const canvas=document.createElement('canvas'); canvas.width=bitmap.width; canvas.height=bitmap.height;
        const ctx=canvas.getContext('2d',{willReadFrequently:true})!; ctx.drawImage(bitmap,0,0);
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
        for(let i=0;i<pixels.data.length;i+=4) { const alpha=pixels.data[i+3]; pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=alpha; pixels.data[i+3]=255; }
        ctx.putImageData(pixels,0,0);
        const png=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('贴纸遮罩保存失败')),'image/png'));
        files[maskPath]=new Uint8Array(await png.arrayBuffer()); masks.set(imagePath,maskPath);
      } finally { bitmap.close(); }
    }
    const cutout=source.replace(`"${shaderName}_diffuse"`,`"${shaderName}_cutout"`)
      .replace(`@${imagePath}@`,`@${maskPath}@`)
      .replace(/float4 inputs:scale = \([^)]*\)/,'float4 inputs:scale = (1, 1, 1, 1)')
      .replace('sourceColorSpace = "sRGB"','sourceColorSpace = "raw"');
    model=model.replace(opacity,`float inputs:opacity.connect = <${path}_cutout.outputs:r>`).replace(source,`${source}\n\n\t\t${cutout}`);
    model=model.replace(block,block.replace(/\n\{$/m,`\n{\n\tcustom string stickerId = ${JSON.stringify(sticker.stickerId)}`));
    const geometryPath=`geometries/Geometry_${sticker.geometryId}.usda`;
    if (!files[geometryPath]) throw new Error('USDZ 贴纸曲面未完整保存，请重新导出。');
    const geometry=decode.decode(files[geometryPath]);
    files[geometryPath]=encode.encode(geometry.replace(/(def Mesh "[^"]*"\s*\{)/,'$1\n\t\tuniform bool doubleSided = true'));
  }
  model=model.replace('string creator = "Three.js USDZExporter"',`$&\n\t\tint stickerCount = ${stickers.length}`);
  files['model.usda']=encode.encode(model);
  return packUsdz(files);
}
