export type ScreenPoint={x:number;y:number};
export type ScreenRect={left:number;top:number;width:number;height:number};
export type CatPawSweep={drop:ScreenPoint;edge:ScreenPoint;entry:ScreenPoint;outside:ScreenPoint;angle:number;duration:number;rect:ScreenRect;pawSize:{width:number;height:number};imageSize:{width:number;height:number};anchor:number};
const ease=(t:number)=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};
const mix=(a:ScreenPoint,b:ScreenPoint,t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});

/** One paw enters from the closest picture edge, wherever the sticker was dropped. */
export function planCatPawSweep(drop:ScreenPoint,rect:ScreenRect,paperExtent:number):CatPawSweep{
  const width=Math.max(94,Math.min(94*2.5,Math.min(rect.width,rect.height)/500*94*2.5));
  const right=rect.left+rect.width,bottom=rect.top+rect.height;
  // Keep border releases just inside the picture so the gripping paw is visible.
  const inset=Math.min(24,rect.width/4,rect.height/4);
  drop={x:Math.max(rect.left+inset,Math.min(right-inset,drop.x)),y:Math.max(rect.top+inset,Math.min(bottom-inset,drop.y))};
  const edgeDistance=Math.min(drop.x-rect.left,right-drop.x,drop.y-rect.top,bottom-drop.y);
  // Match the original sprite's visible paw size, including its transparent margins.
  // The entire foreleg keeps its natural aspect ratio; distance reveals more of it.
  // Exceptionally long reaches scale the whole limb uniformly, never stretch its fur.
  const imageScale=Math.max(width*.68/510,(edgeDistance+24)/(.94*(1536-220)));
  const pawSize={width,height:450*imageScale},anchor=220*imageScale;
  const imageSize={width:1024*imageScale,height:1536*imageScale};
  const entryDistance=anchor+16;
  const margin=Math.max(entryDistance,paperExtent/2+48);
  const candidates=[
    {distance:Math.abs(drop.x-rect.left),edge:{x:rect.left,y:drop.y},point:{x:rect.left-margin,y:drop.y},entry:{x:rect.left-entryDistance,y:drop.y}},
    {distance:Math.abs(right-drop.x),edge:{x:right,y:drop.y},point:{x:right+margin,y:drop.y},entry:{x:right+entryDistance,y:drop.y}},
    {distance:Math.abs(drop.y-rect.top),edge:{x:drop.x,y:rect.top},point:{x:drop.x,y:rect.top-margin},entry:{x:drop.x,y:rect.top-entryDistance}},
    {distance:Math.abs(bottom-drop.y),edge:{x:drop.x,y:bottom},point:{x:drop.x,y:bottom+margin},entry:{x:drop.x,y:bottom+entryDistance}},
  ].sort((a,b)=>a.distance-b.distance);
  const outside=candidates[0].point;
  return {drop,edge:candidates[0].edge,entry:candidates[0].entry,outside,rect,pawSize,imageSize,anchor,duration:.68/.7,angle:Math.atan2(drop.y-outside.y,drop.x-outside.x)*180/Math.PI+90};
}
/** A slow/uncached photograph must not consume the entire sweep before it appears. */
export function advanceCatPawElapsed(elapsed:number,delta:number,imageReady:boolean){
  return imageReady?elapsed+Math.max(0,Math.min(delta,.05)):elapsed;
}
export function catPawPose(plan:CatPawSweep,elapsed:number){
  const progress=Math.max(0,Math.min(1,elapsed/plan.duration));
  const reach=ease(progress/.4),pull=ease((progress-.5)/.5);
  const paw=progress<.4?mix(plan.entry,plan.drop,reach):mix(plan.drop,plan.outside,pull);
  const grabbing=progress>=.4&&progress<.75,scale=grabbing?.94:1;
  const angle=plan.angle*Math.PI/180,inward={x:Math.sin(angle),y:-Math.cos(angle)};
  const distance=(paw.x-plan.edge.x)*inward.x+(paw.y-plan.edge.y)*inward.y;
  // Reveal the natural foreleg up to the frame edge; do not stretch its photograph.
  // Include a margin during grip compression so no crop boundary can appear inside.
  const height=Math.max(plan.pawSize.height,(distance+24)/scale+plan.anchor);
  return {paw,paper:mix(plan.drop,plan.outside,pull),grabbing,scale,height,complete:progress>=1};
}
