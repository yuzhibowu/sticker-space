import profile from './keynoteAppearanceLut.json';
const linear=Array.from({length:256},(_,v)=>v/255<=.04045?v/255/12.92:((v/255+.055)/1.055)**2.4);
const encode=(v:number)=>255*(v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055);
/** Match the browser's managed P3 appearance used by the native calibration captures. */
export function keynoteDisplayReference(r:number,g:number,b:number){
 const R=linear[r],G=linear[g],B=linear[b];
 return [encode(.82259287*R+.17753395*G),encode(.03319951*R+.9667835*G),encode(.01708535*R+.07239572*G+.91030148*B)];
}
/** Inverse measured in Keynote, including its channel-dependent tone mapping. */
export function compensateKeynoteAppearance(pixels:Uint8ClampedArray){
 const n=profile.size,last=n-1,lut=profile.values;
 for(let i=0;i<pixels.length;i+=4){
  const p=keynoteDisplayReference(pixels[i],pixels[i+1],pixels[i+2]).map(v=>Math.max(0,Math.min(last,v*last/255))),base=p.map(v=>Math.min(last-1,Math.floor(v))),f=p.map((v,k)=>v-base[k]);
  for(let c=0;c<3;c++){
   let value=0;
   for(let r=0;r<2;r++)for(let g=0;g<2;g++)for(let b=0;b<2;b++)value+=lut[(((base[0]+r)*n+base[1]+g)*n+base[2]+b)*3+c]*(r?f[0]:1-f[0])*(g?f[1]:1-f[1])*(b?f[2]:1-f[2]);
   pixels[i+c]=Math.round(value);
  }
 }
}
