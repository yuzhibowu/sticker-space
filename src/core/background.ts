import {loadImage} from './assets';
export const isImageBackground=(value:string)=>/^data:image\/(?:png|jpeg);base64,/i.test(value);
export async function importBackgroundImage(file:File){
 if(file.size>25*1024*1024)throw new Error('背景图片请小于 25 MB。');
 const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());
 const png=[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(!png&&!jpeg)throw new Error('请选择 JPG 或 PNG 背景图片。');
 const url=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as string);reader.onerror=()=>reject(new Error('背景图片读取失败'));reader.readAsDataURL(new Blob([file],{type:png?'image/png':'image/jpeg'}));});
 await loadImage(url);return url;
}
/** A single stretch operation is shared by video and live-photo frame rendering. */
export function drawExportBackground(context:CanvasRenderingContext2D,background:string|undefined,image:HTMLImageElement|undefined,width:number,height:number){
 if(image)context.drawImage(image,0,0,width,height);
 else if(background&&background!=='transparent'){context.fillStyle=background;context.fillRect(0,0,width,height);}
}
