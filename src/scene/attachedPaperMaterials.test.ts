import {expect,it} from 'vitest';
import * as THREE from 'three';
import {stickerMaterial,peelPaperMaterials} from './materials';
it('attached ink has no reverse face, while peeled paper retains both faces',()=>{
 const texture=new THREE.Texture(),material=stickerMaterial(texture),geometry=new THREE.PlaneGeometry(1,1),mesh=new THREE.Mesh(geometry,material);
 mesh.updateMatrixWorld();
 const front=new THREE.Raycaster(new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1));
 const reverse=new THREE.Raycaster(new THREE.Vector3(0,0,-1),new THREE.Vector3(0,0,1));
 expect(front.intersectObject(mesh).length).toBeGreaterThan(0);
 expect(reverse.intersectObject(mesh)).toHaveLength(0);
 expect(material.depthTest).toBe(true);expect(material.depthWrite).toBe(false);
 const paper=peelPaperMaterials(texture);expect(paper.back.side).toBe(THREE.BackSide);
 material.dispose();paper.front.dispose();paper.back.dispose();texture.dispose();geometry.dispose();
});
