import * as THREE from 'three';
import {expect,it} from 'vitest';
import {withStableSubpixelSampling,STABLE_SUBPIXEL_OFFSETS} from './stableSampling';
it('四次固定亚像素采样覆盖对称位置，不改变模型时间或相机姿态',()=>{
 const camera=new THREE.PerspectiveCamera(39,.75,.1,100);camera.position.set(1,2,9);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const position=camera.position.clone(),rotation=camera.quaternion.clone(),projection=camera.projectionMatrix.clone(),offsets:number[][]=[];
 withStableSubpixelSampling(camera,1440,1920,(index,count)=>{expect(count).toBe(4);expect(index).toBe(offsets.length);offsets.push([camera.view!.offsetX,camera.view!.offsetY]);});
 expect(offsets).toEqual(STABLE_SUBPIXEL_OFFSETS);expect(offsets.reduce((sum,p)=>sum+p[0],0)).toBe(0);expect(offsets.reduce((sum,p)=>sum+p[1],0)).toBe(0);
 expect(camera.position.equals(position)).toBe(true);expect(camera.quaternion.equals(rotation)).toBe(true);expect(camera.projectionMatrix.equals(projection)).toBe(true);
});
it('绘制出错也会恢复原有相机画幅，不把抖动积累到下一帧',()=>{
 const camera=new THREE.PerspectiveCamera(39,1,.1,100);camera.setViewOffset(720,720,3,4,700,700);const view={...camera.view!},projection=camera.projectionMatrix.clone();
 expect(()=>withStableSubpixelSampling(camera,1440,1440,()=>{throw new Error('draw failed');})).toThrow('draw failed');
 expect(camera.view).toEqual(view);expect(camera.projectionMatrix.equals(projection)).toBe(true);
});
