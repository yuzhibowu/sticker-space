import type {Placement,SurfaceData} from './types';

export const SIGN_POLE_RADIUS=.4;
export const SIGN_BAND_CENTERS=[-1.65,1.65] as const;
export const SIGN_BAND_RADIUS=.415, SIGN_BAND_TUBE=.022;
/** Smooth paper envelope over the solid mounting rings. */
export function signPolePaperRadius(y:number) {
 let radius=SIGN_POLE_RADIUS;
 for(const center of SIGN_BAND_CENTERS){
  const d=Math.abs(y-center);
  const ring=d<=SIGN_BAND_TUBE?SIGN_BAND_RADIUS+Math.sqrt(Math.max(0,SIGN_BAND_TUBE**2-d**2)):SIGN_POLE_RADIUS;
  const drape=SIGN_POLE_RADIUS+(SIGN_BAND_RADIUS+SIGN_BAND_TUBE-SIGN_POLE_RADIUS)*Math.exp(-.5*(d/.032)**2);
  radius=Math.max(radius,ring,drape);
 }
 return radius;
}
/** Legacy stickers can recover their support from the stored click point/normal. */
export function signPoleSurface(surface:SurfaceData,placement:Placement):Extract<SurfaceData,{kind:'cylinder'}>|null {
  if(surface.kind!=='sign')return null;
  const [x,y,z]=placement.position,[nx,ny,nz]=placement.normal,r=Math.hypot(x,z);
  const onPole=Math.abs(r-SIGN_POLE_RADIUS)<=.012&&Math.abs(ny)<=.1&&(nx*x+nz*z)/r>=.96;
  const onBand=SIGN_BAND_CENTERS.some(center=>Math.abs(y-center)<=SIGN_BAND_TUBE+.003)&&r>=SIGN_BAND_RADIUS-.003&&r<=SIGN_BAND_RADIUS+SIGN_BAND_TUBE+.003&&Math.abs(ny)<.9&&(nx*x+nz*z)/r>.4;
  if(!onPole&&!onBand)return null;
  return {id:surface.id,kind:'cylinder',radius:SIGN_POLE_RADIUS,height:surface.height,poleUpper:surface.poleUpper,poleLower:surface.poleLower};
}
