import profile from './freeformEmission.json';
export const FREEFORM_EMISSION_INTENSITY=profile.intensity;
/** Empirical inverse of Freeform's emissive display response; alpha stays byte-exact. */
export function compensateFreeformEmission(pixels:Uint8ClampedArray){
 for(let i=0;i<pixels.length;i+=4)for(let k=0;k<3;k++)pixels[i+k]=profile.inverse[pixels[i+k]];
}
export function lockUSDZEmission(text:string,materialIds:number[]){
 for(const id of materialIds){
  const start=text.indexOf(`def Material "Material_${id}"`);if(start<0)throw new Error('USDZ 外观材质缺失。');
  const end=text.indexOf('\n\tdef Material ',start+1),block=text.slice(start,end<0?text.length:end);
  const locked=block.replace(/int inputs:useSpecularWorkflow = \d+/g,'').replace('uniform token info:id = "UsdPreviewSurface"','uniform token info:id = "UsdPreviewSurface"\n\t\t\tint inputs:useSpecularWorkflow = 1\n\t\t\tcolor3f inputs:specularColor = (0, 0, 0)\n\t\t\tfloat inputs:ior = 1');
  text=text.slice(0,start)+locked+text.slice(end<0?text.length:end);
 }
 return text;
}
