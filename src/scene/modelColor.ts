import * as THREE from 'three';
import {DEFAULT_MODEL_COLOR} from '../core/modelColor';
import type {ModelColorSettings} from '../core/types';
/** Adjust model albedo, preserving lighting, alpha and sticker colors. Uniform updates avoid recompilation. */
export function applyModelColor(material:THREE.Material,value?:ModelColorSettings){
 const settings=value??DEFAULT_MODEL_COLOR;
 let uniforms=material.userData.modelColorUniforms as {modelSaturation:{value:number};modelBrightness:{value:number};modelContrast:{value:number}}|undefined;
 if(!uniforms){
  uniforms={modelSaturation:{value:1},modelBrightness:{value:1},modelContrast:{value:1}};material.userData.modelColorUniforms=uniforms;
  const previous=material.onBeforeCompile,cacheKey=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
   previous.call(material,shader,renderer);Object.assign(shader.uniforms,uniforms);
   shader.fragmentShader=`uniform float modelSaturation;\nuniform float modelBrightness;\nuniform float modelContrast;\nvec3 adjustModelColor(vec3 linearColor){\n if(modelSaturation==1.0 && modelBrightness==1.0 && modelContrast==1.0)return linearColor;\n vec3 c=mix(12.92*linearColor,1.055*pow(max(linearColor,vec3(0.0)),vec3(1.0/2.4))-0.055,step(vec3(0.0031308),linearColor));\n c=mix(vec3(dot(c,vec3(0.2126,0.7152,0.0722))),c,modelSaturation);\n c=max((c-0.5)*modelContrast+0.5,vec3(0.0))*modelBrightness;\n return mix(c/12.92,pow((c+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),c));\n}\n`+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',material.userData.importedUnlit?'#include <map_fragment>':'#include <map_fragment>\n diffuseColor.rgb=adjustModelColor(diffuseColor.rgb);').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n if(any(greaterThan(totalEmissiveRadiance,vec3(0.0))))totalEmissiveRadiance=adjustModelColor(totalEmissiveRadiance);');
  };
  const baseKey=cacheKey();material.customProgramCacheKey=()=>baseKey+'|model-color-v1|'+Boolean(material.userData.importedUnlit);material.needsUpdate=true;
 }
 uniforms.modelSaturation.value=settings.saturation;uniforms.modelBrightness.value=settings.brightness;uniforms.modelContrast.value=settings.contrast;
}
