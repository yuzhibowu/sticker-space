import {expect,it} from 'vitest';
import {PerspectiveCamera,Vector3,Matrix4} from 'three';
import {addUSDZCamera} from './usdzCamera';
import {addUSDZTurntable} from './usdzAnimation';
const model='#usda 1.0\n(\n\tdefaultPrim = "Root"\n)\ndef Xform "Root" {\n def Scope "Scenes" {\n def Xform "Scene" {\n\t\ttoken preliminary:anchoring:type = "plane"\n def Xform "Model" {}\n }\n }\n}\ndef "Materials" {}';
it('preserves zoom, orbit, pan and aspect as a real camera, without cropping the model',()=>{
  const view={position:[3,.8,-6] as [number,number,number],target:[.4,.5,0] as [number,number,number],zoom:5};
  for(const [width,height] of [[1920,1080],[1080,1080]]){
    const output=addUSDZCamera(addUSDZTurntable(model),view,width,height);
    const camera=new PerspectiveCamera(39,width/height,.1,100);camera.zoom=5;camera.position.fromArray(view.position);camera.lookAt(new Vector3(...view.target));camera.updateProjectionMatrix();camera.updateMatrixWorld();
    const transform=output.match(/matrix4d xformOp:transform = \(([^\n]+)\)/)![1].replace(/[()]/g,'').split(',').map(Number);
    const stored=new Matrix4().fromArray(transform);stored.elements.forEach((n,i)=>expect(n).toBeCloseTo(camera.matrixWorld.elements[i],8));
    const focal=Number(output.match(/float focalLength = ([\d.]+)/)![1]);
    const effectiveFov=2*Math.atan(24/(2*focal))*180/Math.PI;expect(effectiveFov).toBeCloseTo(camera.getEffectiveFOV(),7);
    expect(output).toContain(`resolution = (${width}, ${height})`);expect(output).toContain('rel camera = </Root/PreviewCamera>');
    const before=output.split('def Xform "Root"')[1].split('def Camera "PreviewCamera"')[0];
    expect((before.match(/\{/g)??[]).length-(before.match(/\}/g)??[]).length).toBe(1);
    expect(output).toContain('def Xform "Model" {}');expect(output).toContain('endTimeCode = 240');
    expect(output.endsWith('def "Materials" {}')).toBe(true);
  }
});
