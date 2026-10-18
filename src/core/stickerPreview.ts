import {loadImage,previewImage} from './assets';

/** Show the library thumbnail synchronously, then upgrade only this selection.
 * A slow earlier decode must never replace a more recently selected sticker. */
export function loadStickerPreview(source:string,show:(source:string)=>void,decode:(source:string)=>Promise<unknown>=async source=>{const image=await loadImage(source);await image.decode();}){
 const thumbnail=previewImage(source,true),full=previewImage(source);
 let active=true;
 show(thumbnail);
 if(full!==thumbnail)void decode(full).then(()=>{if(active)show(full);}).catch(()=>{/* Keep the selected thumbnail if the larger preview fails. */});
 return()=>{active=false;};
}
