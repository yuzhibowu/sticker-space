import {expect,it} from 'vitest';
import {compensateKeynoteAppearance,keynoteDisplayReference} from './keynoteAppearance';
import {compensateFreeformEmission} from './freeformEmission';
it('uses a separate Keynote RGB calibration and preserves alpha',()=>{
 const keynote=new Uint8ClampedArray([244,221,127,37,0,0,0,0,255,255,255,255]);
 const freeform=keynote.slice();compensateKeynoteAppearance(keynote);compensateFreeformEmission(freeform);
 expect([...keynote.slice(0,3)]).not.toEqual([...freeform.slice(0,3)]);
 expect([keynote[3],keynote[7],keynote[11]]).toEqual([37,0,255]);
 // Yellow requires joint RGB compensation; a grayscale-only inverse visibly oversaturates it.
 expect(keynote[0]).toBeGreaterThan(keynote[1]);expect(keynote[1]).toBeGreaterThan(keynote[2]);
 expect(keynote[2]).toBeGreaterThan(75);
});

it('matches the browser display reference instead of comparing unconverted framebuffer bytes',()=>{
 const reference=keynoteDisplayReference(247,220,109).map(Math.round);
 for(const [i,value] of reference.entries())expect(Math.abs(value-[244,221,127][i])).toBeLessThanOrEqual(2);
 for(const v of [0,64,128,255])for(const c of keynoteDisplayReference(v,v,v))expect(Math.abs(c-v)).toBeLessThan(.1);
});
