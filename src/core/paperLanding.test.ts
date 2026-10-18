import {expect,it} from 'vitest';
import {paperLandingReady} from './paperLanding';
it('keeps the carried sheet across independently delayed Canvas commits and frame callbacks',()=>{
 const oldSource={},newSource={},oldGeometry={},newGeometry={},previous={source:oldSource,geometry:oldGeometry};
 // DOM state committed, but Canvas still owns the previous mesh and callback.
 expect(paperLandingReady(previous,oldSource,oldGeometry,oldGeometry)).toBe(false);
 // A new callback alone cannot expose the old mesh.
 expect(paperLandingReady(previous,newSource,newGeometry,oldGeometry)).toBe(false);
 // A committed mesh alone cannot be reset by the stale callback.
 expect(paperLandingReady(previous,oldSource,oldGeometry,newGeometry)).toBe(false);
 expect(paperLandingReady(previous,newSource,newGeometry,newGeometry)).toBe(true);
});
