import * as THREE from 'three';

export const PEEL_DETACH_THRESHOLD = 1;
export type PeelDropAction = 'return' | 'place' | 'remove';
export function peelDropAction(detached:boolean,onModel:boolean,cancelled=false):PeelDropAction {
  return cancelled||!detached?'return':onModel?'place':'remove';
}
export type PeelEdge = { axis: 'u' | 'v'; sign: 1 | -1 };
export type PeelDirection = {x:number;y:number};

/** Preserve the actual pull angle, including diagonals, in the paper's physical coordinates. */
export function peelDirectionForPull(pull:PeelDirection):PeelDirection {
  const length=Math.hypot(pull.x,pull.y);
  return length<1e-8?{x:1,y:0}:{x:pull.x/length,y:pull.y/length};
}
export function screenPeelDirection(dx:number,dy:number,u:THREE.Vector2,v:THREE.Vector2):PeelDirection {
  const determinant=u.x*v.y-u.y*v.x;
  return Math.abs(determinant)>1e-6
    ?peelDirectionForPull({x:(dx*v.y-dy*v.x)/determinant,y:(u.x*dy-u.y*dx)/determinant})
    :peelDirectionForPull({x:(dx*u.x+dy*u.y)/Math.max(1,u.length()),y:(dx*v.x+dy*v.y)/Math.max(1,v.length())});
}
export function peelExtent(size:[number,number],direction:PeelDirection){return Math.abs(direction.x)*size[0]+Math.abs(direction.y)*size[1];}

/** Screen-space travel also accepts outward and diagonal pulls; small sheets remain easy to grab. */
export function peelProgressForTravel(distance: number, projectedExtent: number) {
  return THREE.MathUtils.clamp((distance - 4) / Math.max(36, projectedExtent * .8), 0, 1);
}

/** Critically damped return; elapsed time is bounded by the caller. */
export function stepPeelSpring(value: number, velocity: number, target: number, dt: number) {
  const omega = 22, offset = value - target, impulse = velocity + omega * offset, decay = Math.exp(-omega * dt);
  return { value: target + (offset + impulse * dt) * decay, velocity: (velocity - omega * impulse * dt) * decay };
}

/** A single regular UV lattice prevents T-junctions and split decal seams from tearing into strips.
 * Only the adhered region follows the relief. The loose region settles into one paper frame. */
export class PeelSheet {
  readonly geometry: THREE.PlaneGeometry;
  private base: Float32Array;
  private field = new Float32Array(65 * 65 * 3);
  private valid = new Uint8Array(65 * 65);
  private carryFrom: Float32Array | null = null;
  private point = new THREE.Vector3();
  private anchor = new THREE.Vector3();
  private tangent = new THREE.Vector3();
  private normal = new THREE.Vector3();
  private across = new THREE.Vector3();
  private frameOrigin = new THREE.Vector3();
  constructor(source: THREE.BufferGeometry, private size: [number, number], private frame = new THREE.Quaternion(), private cylinderRadius?:number) {
    const positions=source.getAttribute('position'),uv=source.getAttribute('uv'),indices=source.index;
    const count=indices?.count??positions.count;
    for(let i=0;i<count;i+=3){
      const a=indices?indices.getX(i):i,b=indices?indices.getX(i+1):i+1,c=indices?indices.getX(i+2):i+2;
      const ax=uv.getX(a)*64,ay=uv.getY(a)*64,bx=uv.getX(b)*64,by=uv.getY(b)*64,cx=uv.getX(c)*64,cy=uv.getY(c)*64;
      const denominator=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(denominator)<1e-10)continue;
      for(let y=Math.max(0,Math.ceil(Math.min(ay,by,cy)));y<=Math.min(64,Math.floor(Math.max(ay,by,cy)));y++)
      for(let x=Math.max(0,Math.ceil(Math.min(ax,bx,cx)));x<=Math.min(64,Math.floor(Math.max(ax,bx,cx)));x++){
        const wa=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/denominator,wb=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/denominator,wc=1-wa-wb;
        if(Math.min(wa,wb,wc)<-1e-5)continue;
        const id=y*65+x;this.valid[id]=1;
        this.field[id*3]=positions.getX(a)*wa+positions.getX(b)*wb+positions.getX(c)*wc;
        this.field[id*3+1]=positions.getY(a)*wa+positions.getY(b)*wb+positions.getY(c)*wc;
        this.field[id*3+2]=positions.getZ(a)*wa+positions.getZ(b)*wb+positions.getZ(c)*wc;
      }
    }
    const queue:number[]=[];this.valid.forEach((v,i)=>{if(v)queue.push(i);});
    for(let head=0;head<queue.length;head++){
      const id=queue[head],x=id%65,y=Math.floor(id/65);
      for(const next of [x>0?id-1:-1,x<64?id+1:-1,y>0?id-65:-1,y<64?id+65:-1]){
        if(next<0||this.valid[next])continue;this.valid[next]=1;
        this.field.set(this.field.subarray(id*3,id*3+3),next*3);queue.push(next);
      }
    }
    this.geometry=new THREE.PlaneGeometry(size[0],size[1],64,64);
    const paper=this.geometry.getAttribute('position'),coords=this.geometry.getAttribute('uv');
    for(let i=0;i<paper.count;i++){
      this.sample(coords.getX(i),coords.getY(i),this.point);paper.setXYZ(i,this.point.x,this.point.y,this.point.z);
    }
    (paper as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);this.base=new Float32Array(paper.array);this.geometry.computeVertexNormals();
  }
  private sample(u:number,v:number,out:THREE.Vector3){
    const x=THREE.MathUtils.clamp(u,0,1)*64,y=THREE.MathUtils.clamp(v,0,1)*64,ix=Math.min(63,Math.floor(x)),iy=Math.min(63,Math.floor(y)),fx=x-ix,fy=y-iy;
    out.set(0,0,0);
    for(const [dx,dy,w] of [[0,0,(1-fx)*(1-fy)],[1,0,fx*(1-fy)],[0,1,(1-fx)*fy],[1,1,fx*fy]]){
      const i=((iy+dy)*65+ix+dx)*3;out.x+=this.field[i]*w;out.y+=this.field[i+1]*w;out.z+=this.field[i+2]*w;
    }
    return out;
  }
  update(progress:number,pull:PeelDirection|PeelEdge,fallbackNormal:THREE.Vector3){
    const direction=peelDirectionForPull('axis' in pull?{x:pull.axis==='u'?pull.sign:0,y:pull.axis==='v'?pull.sign:0}:pull);
    const acrossDirection={x:-direction.y,y:direction.x};
    const position=this.geometry.getAttribute('position'),uv=this.geometry.getAttribute('uv');
    const extent=peelExtent(this.size,direction),crossExtent=peelExtent(this.size,acrossDirection),radius=Math.min(...this.size)*.12;
    const frontProjection=THREE.MathUtils.clamp(progress,0,1)*extent-extent/2;
    const center=this.sample(.5,.5,new THREE.Vector3());
    const axisX=new THREE.Vector3(1,0,0).applyQuaternion(this.frame),axisY=new THREE.Vector3(0,1,0).applyQuaternion(this.frame);
    const fixedTangent=axisX.clone().multiplyScalar(direction.x).addScaledVector(axisY,direction.y);
    const fixedAcross=axisX.clone().multiplyScalar(acrossDirection.x).addScaledVector(axisY,acrossDirection.y);
    const fixedNormal=fallbackNormal.clone().normalize();
    this.frameOrigin.copy(center).addScaledVector(fixedTangent,frontProjection);
    // One plane for the loose portion, so embossing cannot fan adjacent rows into strips.
    let height=0;
    if(!this.cylinderRadius)for(let k=0;k<=64;k++){
      const cross=(k/64-.5)*crossExtent;
      const x=direction.x*frontProjection+acrossDirection.x*cross,y=direction.y*frontProjection+acrossDirection.y*cross;
      this.sample(.5+x/this.size[0],.5+y/this.size[1],this.point);
      height=Math.max(height,this.point.sub(center).dot(fixedNormal));
    }
    this.frameOrigin.addScaledVector(fixedNormal,height);
    const cylinderAngle=Math.atan2(center.x,center.z),cylinderTangent=new THREE.Vector3(Math.cos(cylinderAngle),0,-Math.sin(cylinderAngle));
    const xAround=axisX.dot(cylinderTangent),yAround=axisY.dot(cylinderTangent);
    for(let i=0;i<position.count;i++){
      const u=uv.getX(i),v=uv.getY(i),x=(u-.5)*this.size[0],y=(v-.5)*this.size[1];
      const t=frontProjection-x*direction.x-y*direction.y;
      this.point.fromArray(this.base,i*3);
      if(t>0){
        const creaseX=x+direction.x*t,creaseY=y+direction.y*t,cu=.5+creaseX/this.size[0],cv=.5+creaseY/this.size[1];
        this.sample(cu,cv,this.anchor);this.tangent.copy(fixedTangent);this.normal.copy(fixedNormal);
        if(this.cylinderRadius){
          // A diagonal crease can extend beyond the original UV rectangle. Continue the cylinder
          // analytically instead of clamping all those vertices into a corner.
          if(cu<0||cu>1||cv<0||cv>1){
            const theta=cylinderAngle+(creaseX*xAround+creaseY*yAround)/this.cylinderRadius;
            const radiusAtCrease=Math.hypot(this.anchor.x,this.anchor.z);
            this.anchor.set(Math.sin(theta)*radiusAtCrease,center.y+creaseX*axisX.y+creaseY*axisY.y,Math.cos(theta)*radiusAtCrease);
          }
          this.normal.set(this.anchor.x,0,this.anchor.z).normalize();
          const around=direction.x*xAround+direction.y*yAround,vertical=direction.x*axisX.y+direction.y*axisY.y;
          this.tangent.set(this.normal.z*around,vertical,-this.normal.x*around).normalize();
        }else{
          const cross=x*acrossDirection.x+y*acrossDirection.y,blend=THREE.MathUtils.smoothstep(t,0,radius*2);
          this.across.copy(this.frameOrigin).addScaledVector(fixedAcross,cross);this.anchor.lerp(this.across,blend);
        }
        const angle=Math.min(t/radius,Math.PI*.94),tail=Math.max(0,t-radius*Math.PI*.94);
        this.point.copy(this.anchor).addScaledVector(this.tangent,-radius*Math.sin(angle)-tail*Math.cos(angle)).addScaledVector(this.normal,radius*(1-Math.cos(angle))+tail*Math.sin(angle));
      }
      position.setXYZ(i,this.point.x,this.point.y,this.point.z);
    }
    position.needsUpdate=true;this.geometry.computeVertexNormals();
  }
  /** Unfold one connected sheet toward the camera after detachment, following the pointer. */
  carry(center:THREE.Vector3,rotation:THREE.Quaternion,progress:number){
    const position=this.geometry.getAttribute('position'),uv=this.geometry.getAttribute('uv');
    if(!this.carryFrom)this.carryFrom=new Float32Array(position.array);
    const blend=THREE.MathUtils.smoothstep(progress,0,1);
    for(let i=0;i<position.count;i++){
      this.point.set((uv.getX(i)-.5)*this.size[0],(uv.getY(i)-.5)*this.size[1],0).applyQuaternion(rotation).add(center);
      const from=i*3;
      position.setXYZ(i,this.carryFrom[from]+(this.point.x-this.carryFrom[from])*blend,this.carryFrom[from+1]+(this.point.y-this.carryFrom[from+1])*blend,this.carryFrom[from+2]+(this.point.z-this.carryFrom[from+2])*blend);
    }
    position.needsUpdate=true;this.geometry.computeVertexNormals();
  }
  dispose(){this.geometry.dispose();}
}
