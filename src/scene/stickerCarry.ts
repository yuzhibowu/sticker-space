/** One entry transition shared by screen and surface previews. */
export const stickerCarry={inside:false,enteredAt:0,pixels:30,previewScale:1};
export function carryProgress(){const t=Math.min(1,Math.max(0,(performance.now()-stickerCarry.enteredAt)/200));return t*t*(3-2*t);}

/** Keep the shrink band at the panel edge even when the version label moves. */
export function previewSizeBlend(clientX:number){
 const version=document.querySelector('.version'),panel=document.querySelector('.panel');
 if(!version||!panel)return 1;
 const end=panel.getBoundingClientRect().left,start=end-version.getBoundingClientRect().width-18;
 const t=Math.max(0,Math.min(1,(end-clientX)/Math.max(1,end-start)));
 return t*t*(3-2*t);
}
