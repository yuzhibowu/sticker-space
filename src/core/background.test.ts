import {expect,it,vi} from 'vitest';
import {drawExportBackground,isImageBackground} from './background';
it('stretches image backgrounds to the exact output size, including non-square frames',()=>{
 const image={} as HTMLImageElement,drawImage=vi.fn(),fillRect=vi.fn();
 const context={drawImage,fillRect,fillStyle:''} as unknown as CanvasRenderingContext2D;
 drawExportBackground(context,'data:image/png;base64,AA==',image,1080,1440);
 expect(drawImage).toHaveBeenCalledWith(image,0,0,1080,1440);expect(fillRect).not.toHaveBeenCalled();
 drawExportBackground(context,'#ffffff',undefined,1920,1080);
 expect(context.fillStyle).toBe('#ffffff');expect(fillRect).toHaveBeenCalledWith(0,0,1920,1080);
 expect(isImageBackground('data:image/jpeg;base64,AA==')).toBe(true);expect(isImageBackground('#ffffff')).toBe(false);
});
