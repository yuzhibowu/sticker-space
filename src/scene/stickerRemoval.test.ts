import {describe,expect,it,vi} from 'vitest';
import {StickerRemoval} from './stickerRemoval';
describe('猫爪带走贴纸后的Canvas提交',()=>{
 it('动画完成后旧贴纸在延迟删除的每一帧都保持隐藏，删除只提交一次',()=>{
  const removal=new StickerRemoval(),layers=[{visible:false},{visible:false},{visible:true}],remove=vi.fn();
  const cleanup=vi.fn(()=>{layers[0].visible=true;});
  removal.finish(layers,cleanup,remove);expect(layers.every(layer=>!layer.visible)).toBe(true);
  for(let frame=0;frame<5;frame++){layers.forEach(layer=>{layer.visible=true;});expect(removal.hide(layers)).toBe(true);expect(layers.every(layer=>!layer.visible)).toBe(true);}
  removal.finish(layers,cleanup,remove);expect(remove).toHaveBeenCalledOnce();expect(cleanup).toHaveBeenCalledOnce();
 });
 it('未完成带走时和撤销后重新挂载的贴纸仍正常显示',()=>{
  const removal=new StickerRemoval(),layers=[{visible:true}];expect(removal.hide(layers)).toBe(false);expect(layers[0].visible).toBe(true);
  removal.finish(layers,()=>{},()=>{});layers[0].visible=true;const restored=new StickerRemoval();expect(restored.hide(layers)).toBe(false);expect(layers[0].visible).toBe(true);
 });
});
