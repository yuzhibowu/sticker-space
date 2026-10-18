import {unzipSync,zipSync} from 'fflate';

export function cleanLivePhotoPackage(bytes:Uint8Array):Uint8Array {
 const files=unzipSync(bytes);
 const resources=Object.entries(files).filter(([path])=>
  !path.split('/').some(part=>part.startsWith('.')||part==='__MACOSX')&&/\.(jpg|mov)$/i.test(path));
 const images=resources.filter(([path])=>/\.jpg$/i.test(path));
 const movies=resources.filter(([path])=>/\.mov$/i.test(path));
 if(images.length!==1||movies.length!==1)throw new Error('实况包缺少配对的照片或视频。');
 if(images[0][0].replace(/\.jpg$/i,'')!==movies[0][0].replace(/\.mov$/i,''))throw new Error('实况照片与视频未配对。');
 return zipSync(Object.fromEntries(resources),{level:0});
}
