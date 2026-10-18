import * as THREE from 'three';
/** The reference 3D project composites the shadow once after linear lighting. */
export function installModelShadows(material:THREE.MeshStandardMaterial){
 if(!material.toneMapped)return;
 if(material.userData.modelDeferredShadowInstalled){if(!material.userData.modelDeferredShadow){material.userData.modelDeferredShadow=true;material.needsUpdate=true;}return;}
 material.userData.modelDeferredShadowInstalled=true;
 material.userData.modelDeferredShadow=true;
 const previousCompile=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
  previousCompile.call(this,shader,renderer);
  if(!this.userData.modelDeferredShadow)return;
  const forward=THREE.ShaderChunk.lights_fragment_begin.replace(/^.*directLight\.color \*=.*getShadow\( directionalShadowMap\[ i \].*$/m,'// Shadow is composited once after lighting.');
  // Shadow declarations may already be expanded by a material-specific filter.
  shader.fragmentShader=shader.fragmentShader.replace('void main() {','#include <shadowmask_pars_fragment>\nvoid main() {').replace('#include <lights_fragment_begin>',forward).replace('#include <opaque_fragment>','outgoingLight *= getShadowMask();\n#include <opaque_fragment>');
 };
 material.customProgramCacheKey=()=>`${previousKey}|model-deferred-shadow-v1:${Boolean(material.userData.modelDeferredShadow)}`;
 material.needsUpdate=true;
}
export function setModelShadows(material:THREE.MeshStandardMaterial,enabled:boolean){
 if(enabled)installModelShadows(material);
 else if(material.userData.modelDeferredShadow){material.userData.modelDeferredShadow=false;material.needsUpdate=true;}
}
