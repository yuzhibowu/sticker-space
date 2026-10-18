import * as THREE from 'three';
import type {LightingSettings} from '../core/types';
import {originalLighting} from '../core/modelLighting';
import {setModelShadows} from './modelShadows';
import { makeStudioEnvironment, STUDIO_ENV_INTENSITY } from './studioEnv';
import { makePoleEnvironment } from './galvanizedMetal';

function stoneShadow(light: THREE.DirectionalLight, sign = false) {
  light.castShadow = true;
  light.shadow.mapSize.set(sign ? 4096 : 2048, sign ? 4096 : 2048);
  Object.assign(light.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: .1, far: 20 });
  light.shadow.bias = -.0001;
  light.shadow.normalBias = sign ? .0015 : .006;
  light.shadow.radius = sign ? 2 : 1;
  light.shadow.camera.updateProjectionMatrix();
}
// 大卫用画面侧上方的主光与较弱的补光。手动绕转镜头时同步更新灯位，
// 等价于在固定影棚里转动雕塑，让同一表面的明暗随朝向变化；电线杆沿用原布光。
export function addStudioLights(scene: THREE.Scene, stone = false, sign = false, settings?:LightingSettings, height=5.4) {
  const lights = new THREE.Group(); lights.name = 'StudioLights';
  const ambient=new THREE.AmbientLight(0xffffff, stone ? .065 : sign ? .4 : 1.05);
  lights.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, stone ? 3.15 : sign ? 2.2 : 1.25);
  const keyPosition = new THREE.Vector3(stone ? -4.5 : -3, stone ? 5.5 : 4, stone ? 6 : 5);
  key.position.copy(keyPosition); key.name = 'StudioKey';
  const fill = new THREE.DirectionalLight(0xffffff, stone ? .65 : sign ? .25 : .5);
  const fillPosition = new THREE.Vector3(stone ? 5 : 4, stone ? 2 : 1, stone ? -4 : -3);
  fill.position.copy(fillPosition); fill.name = 'StudioFill';
  if (stone) { stoneShadow(key); stoneShadow(fill); }
  else if(sign) stoneShadow(key, true);
  lights.add(key, fill); scene.add(lights);
  const materials = new Set<THREE.MeshStandardMaterial>(), orientation = new THREE.Quaternion();
  if (stone) scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material instanceof THREE.MeshStandardMaterial && material.userData.stone) materials.add(material);
    }
  });
  let configured=false,original=false;
  const setSettings=(value:LightingSettings)=>{
    original=value.profile==='original';
    if(original){
      configured=true;
      ambient.intensity=(stone?.065:sign?.4:1.05)*value.environmentIntensity/STUDIO_ENV_INTENSITY;
      key.intensity=value.keyLightIntensity;fill.intensity=value.fillLightIntensity;
      keyPosition.set(0,0,Math.hypot(stone?-4.5:sign?-.65:-3,stone?5.5:sign?1:4,stone?6:sign?8:5)).applyEuler(new THREE.Euler(THREE.MathUtils.degToRad(value.keyAngleX),THREE.MathUtils.degToRad(value.keyAngle),0,'XYZ'));
      fillPosition.set(stone?5:4,stone?2:1,stone?-4:-3);
      stoneShadow(key,sign);stoneShadow(fill);
      key.castShadow=value.shadowIntensity>.001;fill.castShadow=stone&&value.shadowIntensity>.001;
      key.shadow.intensity=fill.shadow.intensity=value.shadowIntensity;
      key.position.copy(keyPosition);fill.position.copy(fillPosition);
      return;
    }
    configured=true;ambient.intensity=value.environmentIntensity;key.intensity=value.keyLightIntensity;fill.intensity=value.fillLightIntensity;
    const radius=Math.max(3.5,height*.65);
    keyPosition.set(0,0,radius*3).applyEuler(new THREE.Euler(THREE.MathUtils.degToRad(value.keyAngleX),THREE.MathUtils.degToRad(value.keyAngle),0,'XYZ'));
    fillPosition.set(0,0,radius*3).applyEuler(new THREE.Euler(.35,-.9,0,'XYZ'));
    key.castShadow=value.shadowIntensity>.001;fill.castShadow=false;key.shadow.intensity=value.shadowIntensity;
    key.shadow.mapSize.set(sign?4096:2048,sign?4096:2048);
    key.shadow.radius=sign?2:1;
    Object.assign(key.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius,near:radius,far:radius*5});
    key.shadow.bias=-.0001;key.shadow.normalBias=sign?.0015:radius*.002;key.shadow.camera.updateProjectionMatrix();
    key.position.copy(keyPosition);fill.position.copy(fillPosition);
  };
  setSettings(settings??originalLighting({kind:stone?'mesh':sign?'sign':'cylinder'}));
  return {
    setSettings,
    update(camera: THREE.Camera) {
      if ((!configured||original) && !stone && !sign) return;
      camera.getWorldQuaternion(orientation);
      key.position.copy(keyPosition).applyQuaternion(orientation);
      fill.position.copy(fillPosition).applyQuaternion(orientation);
      // 环境中的柔光反射同样保持在画面坐标中，避免高光像纹理一样固定在皮肤上。
      materials.forEach(material => material.envMapRotation.setFromQuaternion(orientation));
    },
    dispose() { scene.remove(lights); key.shadow.dispose(); fill.shadow.dispose(); materials.clear(); },
  };
}

export function applyStudioLighting(scene: THREE.Scene, renderer: THREE.WebGLRenderer, settings?:LightingSettings) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1;
  const env = makeStudioEnvironment(renderer), pole = makePoleEnvironment(renderer);
  const mapping=()=>settings?.toneMapping==='aces'?THREE.ACESFilmicToneMapping:settings?.toneMapping==='linear'?THREE.LinearToneMapping:THREE.NoToneMapping;
  const materialEnvironment=()=>settings?.profile==='original'?settings.environmentIntensity/STUDIO_ENV_INTENSITY:settings?.environmentIntensity??1;
  const refresh = () => {
  scene.environment = env; scene.environmentIntensity = settings?.environmentIntensity??STUDIO_ENV_INTENSITY;
  if(settings){renderer.toneMapping=mapping();renderer.toneMappingExposure=settings.exposure;}
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) if (material instanceof THREE.MeshStandardMaterial) {
      setModelShadows(material,Boolean(settings&&settings.profile!=='original'));
      // r169 的空 envMap 会改用 scene 的强度，显式指定贴图才能保留大理石自己的补光强度。
      if (material.userData.stone) { material.envMap = env; material.envMapIntensity = .24*materialEnvironment(); material.needsUpdate = true; }
      else if (material.metalness > .5 && !material.userData.imported) { material.envMap = pole.texture; material.envMapIntensity = 2*materialEnvironment(); material.needsUpdate = true; }
    }
  });
  };
  refresh();
  const release=()=>{scene.environment=null;env.dispose();pole.dispose();};
  release.refresh=refresh;
  release.setSettings=(value:LightingSettings)=>{
    settings=value;renderer.toneMapping=mapping();renderer.toneMappingExposure=value.exposure;scene.environmentIntensity=value.environmentIntensity;
    scene.traverse(object=>{if(!(object instanceof THREE.Mesh))return;for(const material of Array.isArray(object.material)?object.material:[object.material])if(material instanceof THREE.MeshStandardMaterial){setModelShadows(material,value.profile!=='original');if(material.userData.stone)material.envMapIntensity=.24*materialEnvironment();else if(material.metalness>.5&&!material.userData.imported)material.envMapIntensity=2*materialEnvironment();}});
  };
  return release;
}
