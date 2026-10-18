import * as THREE from 'three';
/** The rectangular sheet already has a UV boundary; no triangle-edge hashing or
 * internal relief creases are needed for its selection outline. */
export function paperBoundaryGeometry(geometry:THREE.BufferGeometry) {
  const uv=geometry.getAttribute('uv'),p=geometry.getAttribute('position'),edge:{angle:number;index:number}[]=[];
  for(let i=0;i<uv.count;i++){
    const u=uv.getX(i),v=uv.getY(i);
    if(u===0||u===1||v===0||v===1)edge.push({angle:Math.atan2(v-.5,u-.5),index:i});
  }
  edge.sort((a,b)=>a.angle-b.angle);const positions=new Float32Array(edge.length*3);
  edge.forEach(({index},i)=>{positions[i*3]=p.getX(index);positions[i*3+1]=p.getY(index);positions[i*3+2]=p.getZ(index);});
  return new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(positions,3));
}
