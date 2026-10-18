import {MIN_VIEW_ZOOM} from './viewNavigation';
import type {SurfaceData,CameraView} from './types';
export type PoleSurface=Extract<SurfaceData,{kind:'cylinder'|'sign'}>;
// The rounded diamond reaches 1.928 m above/below its center, including its bevel.
export const SIGN_PANEL_HALF_HEIGHT=1.93;
export function poleDimensions(surface:PoleSurface){
  const upper=surface.poleUpper??surface.height/2,lower=surface.poleLower??surface.height/2;
  return {upper,lower,height:upper+lower,center:(upper-lower)/2};
}
export function exposedPoleLength(surface:PoleSurface,side:'upper'|'lower'){
  return poleDimensions(surface)[side]-(surface.kind==='sign'?SIGN_PANEL_HALF_HEIGHT:0);
}
export function resizePole(surface:PoleSurface,side:'upper'|'lower',length:number):PoleSurface {
  const old=poleDimensions(surface),margin=surface.kind==='sign'?SIGN_PANEL_HALF_HEIGHT:0;
  const value=Math.min(surface.kind==='sign'?10:12,Math.max(surface.kind==='sign'?0:.2,length))+margin;
  const upper=side==='upper'?value:old.upper,lower=side==='lower'?value:old.lower;
  return {...surface,poleUpper:upper,poleLower:lower,height:upper+lower};
}

export function defaultModelView(surface:SurfaceData,back=false):CameraView {
  const center=surface.kind==='mesh'||surface.kind==='custom'?0:poleDimensions(surface).center;
  const zoom=Math.max(MIN_VIEW_ZOOM,Math.min(1,5.4/surface.height));
  const distance=8.8*Math.max(1,surface.height/5.4)*zoom;
  return {position:[0,center+.18,back?-distance:distance],target:[0,center,0],zoom};
}
