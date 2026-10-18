import {it,expect} from 'vitest';
import {movingPreviewDpr} from './previewResolution';
it('keeps normal windows at full resolution and budgets large Retina previews',()=>{
 expect(movingPreviewDpr(904,509,2)).toBe(2);
 const dpr=movingPreviewDpr(2184,1228,2);
 expect(dpr).toBeGreaterThanOrEqual(1);expect(dpr).toBeLessThan(2);
 expect(2184*1228*dpr*dpr).toBeCloseTo(3_000_000);
 expect(movingPreviewDpr(2184,1228,1)).toBe(1);
});
