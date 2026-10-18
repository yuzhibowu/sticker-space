import {expect,it} from 'vitest';
import * as THREE from 'three';
import {appearanceVertexShader} from './usdzAppearance';
it('UV baking changes raster position while preserving real view position and texture UVs',()=>{
 const shader=appearanceVertexShader(THREE.ShaderLib.standard.vertexShader);
 expect(shader).toContain('#include <project_vertex>\n gl_Position=vec4(appearanceUV');
 expect(shader).toContain('vViewPosition = - mvPosition.xyz');expect(shader).toContain('#include <uv_vertex>');
});
