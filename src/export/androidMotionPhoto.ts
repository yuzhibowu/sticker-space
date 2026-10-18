/** JPEG + original MP4. Google Motion Photo 1.0 and experimental Oplus O-Live v2.
 * Format references: developer.android.com/media/platform/motion-photo-format
 * and Young-Spark/oppo-live-photo-maker (Find X7 Ultra / ColorOS 14 observations).
 * Platform publishing compatibility requires device tests; no camera model is forged.
 */
export type AndroidMotionProfile='oplus'|'google';
const bytes=(s:string)=>new TextEncoder().encode(s);
function join(...parts:Uint8Array[]){const output=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const part of parts){output.set(part,offset);offset+=part.length;}return output;}
function segment(marker:number,data:Uint8Array){if(data.length>65533)throw new Error('照片元数据过大');return join(new Uint8Array([255,marker,(data.length+2)>>8,(data.length+2)&255]),data);}
function exif(){
 const comment=join(bytes('ASCII\0\0\0'),bytes('Oplus_8388608'));
 const tiff=new Uint8Array(44+comment.length),view=new DataView(tiff.buffer);
 tiff.set(bytes('II'));view.setUint16(2,42,true);view.setUint32(4,8,true);
 view.setUint16(8,1,true);view.setUint16(10,0x8769,true);view.setUint16(12,4,true);view.setUint32(14,1,true);view.setUint32(18,26,true);
 view.setUint16(26,1,true);view.setUint16(28,0x9286,true);view.setUint16(30,7,true);view.setUint32(32,comment.length,true);view.setUint32(36,44,true);tiff.set(comment,44);
 return segment(0xe1,join(bytes('Exif\0\0'),tiff));
}
function mpf(imageLength:number){
 const tiff=new Uint8Array(66),view=new DataView(tiff.buffer);tiff.set(bytes('MM'));view.setUint16(2,42);view.setUint32(4,8);view.setUint16(8,3);
 view.setUint16(10,0xb000);view.setUint16(12,7);view.setUint32(14,4);tiff.set(bytes('0100'),18);
 view.setUint16(22,0xb001);view.setUint16(24,4);view.setUint32(26,1);view.setUint32(30,1);
 view.setUint16(34,0xb002);view.setUint16(36,7);view.setUint32(38,16);view.setUint32(42,50);
 view.setUint32(50,0x00030000);view.setUint32(54,imageLength);
 return segment(0xe2,join(bytes('MPF\0'),tiff));
}
export function packAndroidMotionPhoto(jpeg:Uint8Array,mp4:Uint8Array,profile:AndroidMotionProfile='oplus',presentationUs=0){
 if(jpeg[0]!==255||jpeg[1]!==216||jpeg.at(-2)!==255||jpeg.at(-1)!==217)throw new Error('封面必须是完整 JPEG');
 if(mp4.length<12||new TextDecoder().decode(mp4.subarray(4,8))!=='ftyp')throw new Error('视频必须是 MP4');
 if(!['oplus','google'].includes(profile)||!Number.isSafeInteger(presentationUs)||presentationUs<0)throw new Error('动态照片参数无效');
 // Input must be a freshly encoded cover, without an existing dynamic-photo trailer/XMP/EXIF/MPF.
 let offset=2;
 while(offset+4<jpeg.length&&jpeg[offset]===255){const marker=jpeg[offset+1];if(marker===0xda)break;const length=(jpeg[offset+2]<<8)|jpeg[offset+3];if(length<2||offset+2+length>jpeg.length)throw new Error('JPEG 段损坏');
  const head=new TextDecoder().decode(jpeg.subarray(offset+4,Math.min(offset+40,jpeg.length)));
  if(marker===0xe1||marker===0xe2&&head.startsWith('MPF'))throw new Error('请使用未携带 EXIF/XMP/MPF 的新封面');offset+=2+length;
 }
 const extra=profile==='oplus'?` xmlns:OpCamera="http://ns.oplus.com/photos/1.0/camera/" OpCamera:MotionPhotoPrimaryPresentationTimestampUs="${presentationUs}" OpCamera:MotionPhotoOwner="oplus" OpCamera:OLivePhotoVersion="2" OpCamera:MotionPhotoFeatureFlag="1" OpCamera:VideoLength="${mp4.length}"`:'';
 const xml=`<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:GCamera="http://ns.google.com/photos/1.0/camera/" xmlns:Container="http://ns.google.com/photos/1.0/container/" xmlns:Item="http://ns.google.com/photos/1.0/container/item/" GCamera:MotionPhoto="1" GCamera:MotionPhotoVersion="1" GCamera:MotionPhotoPresentationTimestampUs="${presentationUs}"${extra}><Container:Directory><rdf:Seq><rdf:li rdf:parseType="Resource"><Container:Item Item:Mime="image/jpeg" Item:Semantic="Primary" Item:Length="0" Item:Padding="0"/></rdf:li><rdf:li rdf:parseType="Resource"><Container:Item Item:Mime="video/mp4" Item:Semantic="MotionPhoto" Item:Length="${mp4.length}" Item:Padding="0"/></rdf:li></rdf:Seq></Container:Directory></rdf:Description></rdf:RDF></x:xmpmeta>`;
 const xmp=segment(0xe1,join(bytes('http://ns.adobe.com/xap/1.0/\0'),bytes(xml)));
 const metadata=profile==='oplus'?join(exif(),xmp):xmp;
 const imageLength=jpeg.length+metadata.length+(profile==='oplus'?mpf(0).length:0);
 return join(jpeg.subarray(0,2),metadata,profile==='oplus'?mpf(imageLength):new Uint8Array(),jpeg.subarray(2),mp4);
}
