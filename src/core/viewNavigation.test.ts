import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { centerOrbitAxis, panView, zoomView, MAX_VIEW_ZOOM } from './viewNavigation';
import { parseProject } from './project';
import { DAVID, POLE, type StickerSceneData } from './types';

function view() {
  const camera = new THREE.PerspectiveCamera(39,16/9,.1,100), target = new THREE.Vector3();
  camera.position.set(0,0,3.3); camera.lookAt(target); camera.updateMatrixWorld();
  return {camera,target};
}
describe('局部放大与屏幕平移',()=>{
  it.each([DAVID,POLE])('%s：最大放大覆盖局部细节，相机不会穿入模型',surface=>{
    const {camera,target}=view(), position=camera.position.clone();
    zoomView(camera,target,100);
    expect(camera.zoom).toBe(MAX_VIEW_ZOOM); expect(camera.position.distanceTo(position)).toBe(0);
    const viewportHeight=2*camera.position.distanceTo(target)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/camera.zoom;
    expect(viewportHeight).toBeLessThan(surface.height/50);
  });
  it('在实际表面处放大，指针下的细节不漂移',()=>{
    const {camera,target}=view(), focus=new THREE.Vector3(.2,-.7,.4);
    const before=focus.clone().project(camera), pointer=new THREE.Vector2(before.x,before.y);
    zoomView(camera,target,16,pointer,focus);
    const after=focus.clone().project(camera);
    expect(Math.hypot(after.x-before.x,after.y-before.y)).toBeLessThan(1e-8);
  });
  it('Command 平移只改变取景，不改变朝向或倍率，放大后按像素移动',()=>{
    const {camera,target}=view(); zoomView(camera,target,8);
    const orientation=camera.quaternion.clone(), offset=camera.position.clone().sub(target), point=target.clone();
    const before=point.clone().project(camera);
    panView(camera,target,100,50,720);
    const after=point.clone().project(camera);
    expect(camera.quaternion.angleTo(orientation)).toBeLessThan(1e-8);
    expect(camera.position.clone().sub(target).distanceTo(offset)).toBeLessThan(1e-8);
    expect(camera.zoom).toBe(8);
    expect((after.x-before.x)*1280/2).toBeCloseTo(100,5);
    expect(-(after.y-before.y)*720/2).toBeCloseTo(50,5);
  });
  it('平移中心和倍率能随工程往返，旧工程仍兼容，无效倍率会拒绝',()=>{
    const scene:StickerSceneData={version:1,surface:POLE,assets:[{id:'png',name:'test',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',width:1,height:1}],stickers:[],view:{position:[0,-1,3.3],target:[0,-1,0],zoom:16}};
    expect(parseProject(JSON.parse(JSON.stringify(scene))).view).toEqual(scene.view);
    expect(parseProject({...scene,view:{position:[0,0,8],target:[0,0,0]}}).view?.zoom).toBeUndefined();
    expect(()=>parseProject({...scene,view:{...scene.view,zoom:NaN}})).toThrow();
    expect(()=>parseProject({...scene,view:{...scene.view,zoom:1000}})).toThrow();
  });
});

it('restores the model axis after pointer zoom or pan without changing viewing distance',()=>{
 const camera=new THREE.PerspectiveCamera();camera.position.set(2,1,8);
 const target=new THREE.Vector3(1,.5,2),offset=camera.position.clone().sub(target);
 centerOrbitAxis(camera,target);
 expect(target.toArray()).toEqual([0,.5,0]);
 expect(camera.position.clone().sub(target).toArray()).toEqual(offset.toArray());
});
