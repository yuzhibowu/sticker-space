import {expect,it,vi} from 'vitest';
import {StickerPeelSound} from './peelSound';
const fake=()=>({configure:vi.fn(),unlock:vi.fn(),reset:vi.fn(),begin:vi.fn(),update:vi.fn(),end:vi.fn(),stop:vi.fn()});
it('unlocks on a gesture and only plays for the current peeling sheet',()=>{
  const engine=fake(),sound=new StickerPeelSound(engine);
  sound.prepare();sound.prepare();expect(engine.configure).toHaveBeenCalledTimes(1);
  sound.begin('a');expect(engine.unlock).toHaveBeenCalledTimes(1);
  sound.move('b',.4,100);expect(engine.update).not.toHaveBeenCalled();
  sound.move('a',.4,100);expect(engine.update).toHaveBeenCalledWith(.4,100);
  sound.end('a',1);sound.move('a',1,120);expect(engine.update).toHaveBeenCalledTimes(1);
});
it('cancels sound on lost capture without stopping a newer gesture owner',()=>{
  const engine=fake(),sound=new StickerPeelSound(engine);
  sound.begin('a');sound.begin('b');sound.cancel('a');expect(engine.stop).not.toHaveBeenCalled();
  sound.cancel('b');expect(engine.stop).toHaveBeenCalledTimes(1);
  sound.move('b',.8,200);expect(engine.update).not.toHaveBeenCalled();
});
