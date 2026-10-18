/** macOS natural scrolling: a rightward finger gesture yields negative deltaX.
 * Local positive roll is counterclockwise, for every model and preview. */
export function horizontalStickerRoll(degrees:number,deltaX:number){
 const delta=Math.max(-100,Math.min(100,deltaX))*.25;
 return ((degrees+delta+180)%360+360)%360-180;
}

/** Natural vertical scrolling shares one size curve in placement and editing. */
export function verticalStickerSize(width:number,deltaY:number){return Math.max(.04,Math.min(4.4,width*Math.exp(Math.max(-100,Math.min(100,deltaY))*.002)));}
