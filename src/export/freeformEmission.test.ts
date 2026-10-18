import {expect,it} from 'vitest';
import profile from './freeformEmission.json';
import {compensateFreeformEmission,lockUSDZEmission} from './freeformEmission';
it('measured inverse keeps all 256 gray levels within one displayed code and preserves alpha',()=>{
 for(let value=0;value<256;value++){
  const rgba=new Uint8ClampedArray([value,value,value,37]);compensateFreeformEmission(rgba);
  expect(Math.abs(profile.response[rgba[0]]-value)).toBeLessThanOrEqual(1);expect(rgba[3]).toBe(37);
 }
});
it('baked materials have one unlit workflow declaration and keep texture alpha sampling',()=>{
 const model='def Material "Material_4" {\n uniform token info:id = "UsdPreviewSurface"\n int inputs:useSpecularWorkflow = 0\n float inputs:opacity.connect = </Texture.outputs:a>\n}\n\tdef Material "Material_5" {\n uniform token info:id = "UsdPreviewSurface"\n}';
 const locked=lockUSDZEmission(model,[4]);expect(locked.match(/inputs:useSpecularWorkflow/g)).toHaveLength(1);expect(locked).toContain('inputs:ior = 1');expect(locked).toContain('inputs:opacity.connect');expect(locked.split('def Material "Material_5"')[1]).not.toContain('useSpecularWorkflow');expect(()=>lockUSDZEmission(model,[9])).toThrow('材质缺失');
});
