import * as THREE from 'three';

const STEP=.016;
export type SignHeightField={sample:(point:THREE.Vector3)=>number};
const fields=new WeakMap<THREE.BufferGeometry,Map<string,SignHeightField>>();
/** Conservative outer surface, rasterized once per model and projection direction.
 * A cell keeps the greatest height of every overlapping triangle. Tiny raised rims
 * and lettering therefore remain above the paper even between grid samples. */
export function signHeightField(geometry:THREE.BufferGeometry,normal:THREE.Vector3):SignHeightField {
  let cache=fields.get(geometry);if(!cache){cache=new Map();fields.set(geometry,cache);}
  const key=normal.toArray().map(n=>n.toFixed(6)).join(',');const cached=cache.get(key);if(cached)return cached;
  const z=normal.clone().normalize(),x=(Math.abs(z.y)>.98?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0)).cross(z).normalize(),y=z.clone().cross(x);
  const positions=geometry.getAttribute('position'),projected=new Float64Array(positions.count*3);
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(let i=0;i<positions.count;i++){
    const px=positions.getX(i),py=positions.getY(i),pz=positions.getZ(i),u=px*x.x+py*x.y+pz*x.z,v=px*y.x+py*y.y+pz*y.z;
    projected[i*3]=u;projected[i*3+1]=v;projected[i*3+2]=px*z.x+py*z.y+pz*z.z;
    minX=Math.min(minX,u);minY=Math.min(minY,v);maxX=Math.max(maxX,u);maxY=Math.max(maxY,v);
  }
  minX=Math.floor(minX/STEP)*STEP;minY=Math.floor(minY/STEP)*STEP;
  const width=Math.ceil((maxX-minX)/STEP)+1,height=Math.ceil((maxY-minY)/STEP)+1,heights=new Float32Array(width*height).fill(-Infinity),index=geometry.index;
  for(let i=0;i<(index?.count??positions.count);i+=3){
    const a=(index?index.getX(i):i)*3,b=(index?index.getX(i+1):i+1)*3,c=(index?index.getX(i+2):i+2)*3;
    const ax=projected[a],ay=projected[a+1],bx=projected[b],by=projected[b+1],cx=projected[c],cy=projected[c+1];
    const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(Math.abs(area)<1e-12)continue;
    const sign=area>0?1:-1,top=Math.max(projected[a+2],projected[b+2],projected[c+2]);
    const left=Math.max(0,Math.floor((Math.min(ax,bx,cx)-minX)/STEP)),right=Math.min(width-1,Math.floor((Math.max(ax,bx,cx)-minX)/STEP));
    const bottom=Math.max(0,Math.floor((Math.min(ay,by,cy)-minY)/STEP)),upper=Math.min(height-1,Math.floor((Math.max(ay,by,cy)-minY)/STEP));
    const abx=bx-ax,aby=by-ay,bcx=cx-bx,bcy=cy-by,cax=ax-cx,cay=ay-cy;
    const abMargin=STEP*.5*(Math.abs(abx)+Math.abs(aby)),bcMargin=STEP*.5*(Math.abs(bcx)+Math.abs(bcy)),caMargin=STEP*.5*(Math.abs(cax)+Math.abs(cay));
    for(let row=bottom;row<=upper;row++)for(let col=left;col<=right;col++){
      const u=minX+(col+.5)*STEP,v=minY+(row+.5)*STEP;
      if(sign*(abx*(v-ay)-aby*(u-ax)) < -abMargin || sign*(bcx*(v-by)-bcy*(u-bx)) < -bcMargin || sign*(cax*(v-cy)-cay*(u-cx)) < -caMargin)continue;
      const k=row*width+col;if(top>heights[k])heights[k]=top;
    }
  }
  const field:SignHeightField={sample:point=>{
    const col=Math.floor((point.dot(x)-minX)/STEP),row=Math.floor((point.dot(y)-minY)/STEP);let h=-Infinity;
    // A one-cell support margin covers the interiors of the sheet's triangles.
    for(let j=Math.max(0,row-1);j<=Math.min(height-1,row+1);j++)for(let i=Math.max(0,col-1);i<=Math.min(width-1,col+1);i++)h=Math.max(h,heights[j*width+i]);
    return Number.isFinite(h)?h-point.dot(z):NaN;
  }};
  cache.set(key,field);if(cache.size>8)cache.delete(cache.keys().next().value!);return field;
}
