/** Reparameterize a relief profile by paper length instead of projected width.
 * A jump to another support consumes paper: UVs bend around it rather than
 * stretching one grid cell into a long ribbon. Flat/shallow relief is untouched. */
export function foldedSignPaper(heights:Float64Array,columns:number,rows:number,width:number,height:number) {
 const stride=columns+1,dx=width/columns,dy=height/rows;
 let discontinuous=false;
 for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
  const k=j*stride+i;
  if((i<columns&&Math.abs(heights[k+1]-heights[k])>.16)||(j<rows&&Math.abs(heights[k+stride]-heights[k])>.16))discontinuous=true;
 }
 if(!discontinuous)return null;
 const interpolate=(x:number,y:number)=>{
  const u=Math.max(0,Math.min(columns,(x/width+.5)*columns)),v=Math.max(0,Math.min(rows,(y/height+.5)*rows));
  const i=Math.min(columns-1,Math.floor(u)),j=Math.min(rows-1,Math.floor(v)),a=u-i,b=v-j,k=j*stride+i;
  return (heights[k]*(1-a)+heights[k+1]*a)*(1-b)+(heights[k+stride]*(1-a)+heights[k+stride+1]*a)*b;
 };
 type Point=[number,number];
 const profile=(steps:number,extent:number,at:(coordinate:number)=>number)=>{
  const middle=extent/2,center:Point=[0,at(0)];
  const sides=[-1,1].map(sign=>{
   const points:Point[]=[center],lengths=[0];
   // Include zero exactly, even for odd grid dimensions.
   const coordinates=Array.from({length:steps+1},(_,i)=>(i/steps-.5)*extent).filter(value=>value*sign>1e-9).sort((a,b)=>Math.abs(a)-Math.abs(b));
   for(const coordinate of coordinates){
    const point:Point=[coordinate,at(coordinate)],previous=points.at(-1)!;
    lengths.push(lengths.at(-1)!+Math.hypot(point[0]-previous[0],point[1]-previous[1]));points.push(point);
   }
   return {points,lengths};
  });
  return (distance:number):Point=>{
   if(Math.abs(distance)<1e-9)return center;
   const {points,lengths}=sides[distance<0?0:1],target=Math.min(Math.abs(distance),middle);
   let lower=0,upper=lengths.length-1;
   while(lower+1<upper){const mid=(lower+upper)>>1;if(lengths[mid]<target)lower=mid;else upper=mid;}
   const t=(target-lengths[lower])/Math.max(1e-12,lengths[upper]-lengths[lower]),a=points[lower],b=points[upper];
   return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  };
 };
 const centerLine=profile(rows,height,y=>interpolate(0,y)),positions=new Float64Array(heights.length*3);
 for(let j=0;j<=rows;j++){
  const [y]=centerLine(j*dy-height/2),row=profile(columns,width,x=>interpolate(x,y));
  for(let i=0;i<=columns;i++){
   const [x,z]=row(i*dx-width/2),k=(j*stride+i)*3;
   positions[k]=x;positions[k+1]=y;positions[k+2]=z;
  }
 }
 // March out from the anchor. Each new vertex must lie inside the two
 // rest-length spheres of its already fixed neighbours. Their intersection
 // is solved directly, avoiding a slow iterative cloth simulation.
 const distance=(a:number,b:number)=>Math.hypot(positions[a]-positions[b],positions[a+1]-positions[b+1],positions[a+2]-positions[b+2]);
 const inside=(point:number,center:number,radius:number)=>distance(point,center)<=radius+1e-10;
 const project=(point:number,center:number,radius:number)=>{
  const d=distance(point,center);if(d<=radius)return;
  for(let axis=0;axis<3;axis++)positions[point+axis]=positions[center+axis]+(positions[point+axis]-positions[center+axis])*radius/d;
 };
 const constrain=(point:number,a:number,ra:number,b?:number,rb=0)=>{
  if(b===undefined){project(point,a,ra);return;}
  if(inside(point,a,ra)&&inside(point,b,rb))return;
  const original=positions.slice(point,point+3);
  project(point,a,ra);if(inside(point,b,rb))return;
  positions.set(original,point);project(point,b,rb);if(inside(point,a,ra))return;
  const d=distance(a,b);
  if(d<1e-10){project(point,a,Math.min(ra,rb));return;}
  const ex=(positions[b]-positions[a])/d,ey=(positions[b+1]-positions[a+1])/d,ez=(positions[b+2]-positions[a+2])/d;
  const along=(ra*ra-rb*rb+d*d)/(2*d),r=Math.sqrt(Math.max(0,ra*ra-along*along));
  const cx=positions[a]+ex*along,cy=positions[a+1]+ey*along,cz=positions[a+2]+ez*along;
  let vx=original[0]-cx,vy=original[1]-cy,vz=original[2]-cz;
  const dot=vx*ex+vy*ey+vz*ez;vx-=dot*ex;vy-=dot*ey;vz-=dot*ez;
  let length=Math.hypot(vx,vy,vz);
  if(length<1e-12){vx=-ey;vy=ex;vz=0;length=Math.hypot(vx,vy);if(length<1e-12){vx=1;length=1;}}
  positions[point]=cx+vx*r/length;positions[point+1]=cy+vy*r/length;positions[point+2]=cz+vz*r/length;
 };
 const middleRow=Math.round(rows/2),middleCol=Math.round(columns/2),rx=dx*1.01,ry=dy*1.01;
 const settleRow=(row:number,previous?:number)=>{
  const center=(row*stride+middleCol)*3;
  if(previous!==undefined)constrain(center,(previous*stride+middleCol)*3,ry);
  for(const direction of [-1,1])for(let col=middleCol+direction;col>=0&&col<=columns;col+=direction){
   constrain((row*stride+col)*3,(row*stride+col-direction)*3,rx,previous===undefined?undefined:(previous*stride+col)*3,ry);
  }
 };
 settleRow(middleRow);
 for(const direction of [-1,1])for(let row=middleRow+direction;row>=0&&row<=rows;row+=direction)settleRow(row,row-direction);
 return positions;
}
