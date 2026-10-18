import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { addStudioLights } from './lighting';

const cameraAt = (x: number, z: number) => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(x, 0, z); camera.lookAt(0, 0, 0);
  return camera;
};
describe('大卫旋转布光', () => {
  it('绕转镜头后，同一块皮肤的入射光改变，主光仍位于画面侧上方', () => {
    const scene = new THREE.Scene(), rig = addStudioLights(scene, true);
    const key = scene.getObjectByName('StudioKey') as THREE.DirectionalLight;
    const normal = new THREE.Vector3(0, 0, 1);
    const front = cameraAt(0, 8), back = cameraAt(0, -8);
    rig.update(front);
    const localPosition = key.position.clone().applyQuaternion(front.quaternion.clone().invert());
    const frontLight = Math.max(0, normal.dot(key.position.clone().normalize())) * key.intensity;
    rig.update(back);
    const backLight = Math.max(0, normal.dot(key.position.clone().normalize())) * key.intensity;
    expect(frontLight - backLight).toBeGreaterThan(1);
    expect(key.position.clone().applyQuaternion(back.quaternion.clone().invert()).distanceTo(localPosition)).toBeLessThan(1e-8);
    expect(key.castShadow).toBe(true);
    rig.dispose(); expect(scene.getObjectByName('StudioKey')).toBeUndefined();
  });
  it('大理石反射跟随画面方向，贴纸与电线杆材质不被更改', () => {
    const scene = new THREE.Scene();
    const stone = new THREE.MeshStandardMaterial(); stone.userData.stone = true;
    const sticker = new THREE.MeshPhysicalMaterial({ color: 0, emissive: 0xffffff, specularIntensity: 0 });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(), stone), new THREE.Mesh(new THREE.PlaneGeometry(), sticker));
    const rig = addStudioLights(scene, true), camera = cameraAt(8, 0);
    rig.update(camera);
    expect(new THREE.Quaternion().setFromEuler(stone.envMapRotation).angleTo(camera.quaternion)).toBeLessThan(1e-8);
    expect(sticker.envMapRotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
    expect(sticker.emissive.getHex()).toBe(0xffffff);
    rig.dispose();
    const poleRig = addStudioLights(scene, false), key = scene.getObjectByName('StudioKey')!;
    const initial = key.position.clone(); poleRig.update(camera);
    expect(key.position.distanceTo(initial)).toBe(0); poleRig.dispose();
  });
});

it('3D reference controls have independent intensities, Euler angles, shadow strength and camera tracking',async()=>{
 const {DEFAULT_LIGHTING,REMBRANDT_LIGHTING}=await import('../core/modelLighting');
 const scene=new THREE.Scene(),rig=addStudioLights(scene,true,false,{...DEFAULT_LIGHTING}),key=scene.getObjectByName('StudioKey') as THREE.DirectionalLight,fill=scene.getObjectByName('StudioFill') as THREE.DirectionalLight;
 expect(key.intensity).toBe(.68);expect(fill.intensity).toBe(.26);expect(key.castShadow).toBe(false);
 rig.update(cameraAt(0,8));const before=key.position.clone();
 rig.setSettings({...DEFAULT_LIGHTING,keyAngleX:45,shadowIntensity:.55});rig.update(cameraAt(0,8));expect(key.position.distanceTo(before)).toBeGreaterThan(1);expect(key.shadow.intensity).toBe(.55);expect(key.castShadow).toBe(true);expect(fill.castShadow).toBe(false);
 rig.setSettings({...REMBRANDT_LIGHTING,environmentIntensity:0,keyLightIntensity:0,fillLightIntensity:0});expect(key.intensity+fill.intensity+(scene.getObjectByProperty('type','AmbientLight') as THREE.AmbientLight).intensity).toBe(0);rig.dispose();
});
it('model shadows are composited once before tone mapping, with original-color sticker materials excluded',async()=>{
 const {installModelShadows}=await import('./modelShadows');
 const material=new THREE.MeshPhysicalMaterial(),shader={...THREE.ShaderLib.physical};installModelShadows(material);
 material.onBeforeCompile(shader as any,{} as THREE.WebGLRenderer);
 expect(shader.fragmentShader).toContain('outgoingLight *= getShadowMask();');expect(shader.fragmentShader).not.toContain('getShadow( directionalShadowMap[ i ]');
 expect(shader.fragmentShader.indexOf('outgoingLight *=')).toBeLessThan(shader.fragmentShader.indexOf('#include <tonemapping_fragment>'));
 const hook=material.onBeforeCompile;installModelShadows(material);expect(material.onBeforeCompile).toBe(hook);
 const sticker=new THREE.MeshPhysicalMaterial({toneMapped:false});installModelShadows(sticker);expect(sticker.userData.modelDeferredShadow).toBeUndefined();
});
it.each([{kind:'mesh',stone:true,sign:false},{kind:'sign',stone:false,sign:true},{kind:'cylinder',stone:false,sign:false}] as const)('neutral $kind exactly restores the original rig, including shadows and camera tracking',async({kind,stone,sign})=>{
 const {originalLighting}=await import('../core/modelLighting');
 const legacy=new THREE.Scene(),neutral=new THREE.Scene(),a=addStudioLights(legacy,stone,sign),b=addStudioLights(neutral,stone,sign,originalLighting({kind}));
 for(const camera of [cameraAt(0,8),cameraAt(8,0)]){
  a.update(camera);b.update(camera);
  for(const name of ['StudioKey','StudioFill']){
   const old=legacy.getObjectByName(name) as THREE.DirectionalLight,next=neutral.getObjectByName(name) as THREE.DirectionalLight;
   expect(next.position.distanceTo(old.position)).toBeLessThan(1e-12);expect(next.intensity).toBe(old.intensity);expect(next.castShadow).toBe(old.castShadow);
   if(old.castShadow){expect(next.shadow.camera.projectionMatrix.elements).toEqual(old.shadow.camera.projectionMatrix.elements);expect(next.shadow.normalBias).toBe(old.shadow.normalBias);}
  }
  expect((neutral.getObjectByProperty('type','AmbientLight') as THREE.AmbientLight).intensity).toBeCloseTo((legacy.getObjectByProperty('type','AmbientLight') as THREE.AmbientLight).intensity,12);
 }
 a.dispose();b.dispose();
});
it('returning to neutral restores the original forward shadow shader',async()=>{
 const {setModelShadows}=await import('./modelShadows');const material=new THREE.MeshStandardMaterial();
 setModelShadows(material,true);const studioKey=material.customProgramCacheKey();
 setModelShadows(material,false);const shader={...THREE.ShaderLib.standard};material.onBeforeCompile(shader as any,{} as THREE.WebGLRenderer);
 expect(shader.fragmentShader).not.toContain('outgoingLight *= getShadowMask();');expect(shader.fragmentShader).toContain('#include <lights_fragment_begin>');expect(material.customProgramCacheKey()).not.toBe(studioKey);
});
