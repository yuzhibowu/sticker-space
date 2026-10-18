import {PerspectiveCamera,Vector3} from 'three';
import type {CameraView} from '../core/types';

/** Keep the camera outside the animated model: SceneKit ignores resetXformStack. */
export function addUSDZCamera(model:string,view:CameraView|undefined,width:number,height:number) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0)throw new Error('USDZ 取景尺寸无效。');
  const camera=new PerspectiveCamera(39,width/height,.1,100);
  camera.position.fromArray(view?.position??[0,.18,8.8]);camera.lookAt(new Vector3(...(view?.target??[0,0,0])));camera.updateMatrixWorld();
  const values=camera.matrixWorld.elements,number=(value:number)=>Number(value.toFixed(9));
  const matrix=Array.from({length:4},(_,row)=>`(${values.slice(row*4,row*4+4).map(number).join(', ')})`).join(', ');
  const verticalAperture=24,focalLength=verticalAperture/(2*Math.tan(39*Math.PI/360))*(view?.zoom??1);
  const cameraPrim=`
    def Camera "PreviewCamera" {
        matrix4d xformOp:transform = (${matrix})
        uniform token[] xformOpOrder = ["xformOp:transform"]
        token projection = "perspective"
        float focalLength = ${number(focalLength)}
        float horizontalAperture = ${number(verticalAperture*width/height)}
        float verticalAperture = ${verticalAperture}
        float2 clippingRange = (0.1, 100)
    }
`;
  const settingsPrim=`
    def RenderSettings "PreviewRenderSettings" {
        rel camera = </Root/PreviewCamera>
        uniform int2 resolution = (${width}, ${height})
        uniform float pixelAspectRatio = 1
        uniform token aspectRatioConformPolicy = "cropAperture"
        uniform float4 dataWindowNDC = (0, 0, 1, 1)
    }
`;
  if(!model.includes('defaultPrim = "Root"')||model.includes('def Camera "PreviewCamera"'))throw new Error('USDZ 相机场景结构无效。');
  const materials=model.indexOf('\ndef "Materials"'),close=model.lastIndexOf('}',materials<0?model.length:materials);
  return (model.slice(0,close)+cameraPrim+settingsPrim+model.slice(close)).replace('defaultPrim = "Root"','defaultPrim = "Root"\n\trenderSettingsPrimPath = "/Root/PreviewRenderSettings"');
}
