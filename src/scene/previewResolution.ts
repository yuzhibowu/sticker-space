/** Keep moving previews within a GPU pixel budget; settled images retain full DPR. */
export function movingPreviewDpr(width:number,height:number,fullDpr:number){
 return Math.min(fullDpr,Math.max(1,Math.sqrt(3_000_000/Math.max(1,width*height))));
}
