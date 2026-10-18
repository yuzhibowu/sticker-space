type Layer={visible:boolean}|null;
/** A completed cat-paw discard stays hidden across the asynchronous Canvas removal. */
export class StickerRemoval{
 private finished=false;
 hide(layers:Layer[]){if(!this.finished)return false;for(const layer of layers)if(layer)layer.visible=false;return true;}
 finish(layers:Layer[],cleanup:()=>void,remove:()=>void){
  if(this.finished)return;
  this.finished=true;cleanup();this.hide(layers);remove();
 }
}
