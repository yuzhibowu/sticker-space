import {expect,it} from 'vitest';
import {planCatPawSweep,catPawPose,advanceCatPawElapsed} from './catPaw';
const rect={left:100,top:100,width:800,height:500};
it('puts the paw at the chosen blank drop, from the closest edge instead of a fixed bin',()=>{
  const upper=planCatPawSweep({x:150,y:120},rect,80),lower=planCatPawSweep({x:850,y:580},rect,80);
  expect(upper.outside.y).toBeLessThan(rect.top);expect(lower.outside.y).toBeGreaterThan(rect.top+rect.height);
  expect(catPawPose(upper,upper.duration*.4).paw).toEqual(upper.drop);
  expect(catPawPose(lower,lower.duration*.4).paw).toEqual(lower.drop);
  expect(upper.angle).not.toBe(lower.angle);
});
it('holds the paper until a delayed paw image is ready, then plays the complete sweep',()=>{
 const plan=planCatPawSweep({x:500,y:599},rect,80);let elapsed=0;
 for(let i=0;i<600;i++)elapsed=advanceCatPawElapsed(elapsed,1/60,false);
 expect(elapsed).toBe(0);expect(catPawPose(plan,elapsed).paper).toEqual(plan.drop);
 expect(catPawPose(plan,elapsed).complete).toBe(false);
 for(let i=0;i<25;i++)elapsed=advanceCatPawElapsed(elapsed,1/60,true);
 expect(catPawPose(plan,elapsed).grabbing).toBe(true);
 expect(catPawPose(plan,elapsed).complete).toBe(false);
 expect(plan.drop.y).toBe(576);
 const below=planCatPawSweep({x:500,y:700},rect,80);
 expect(below.drop.y).toBe(576);expect(below.outside.y).toBeGreaterThan(600);
});
it('holds the whole sticker until contact, then pulls it out without fading',()=>{
  const plan=planCatPawSweep({x:840,y:350},rect,300);
  expect(catPawPose(plan,plan.duration*.3).paper).toEqual(plan.drop);
  const end=catPawPose(plan,plan.duration);expect(end.paper).toEqual(plan.outside);expect(end.complete).toBe(true);
  expect(plan.outside.x-900).toBeGreaterThan(150);
});
it('collects releases over app controls at the picture edge instead of reaching into the controls',()=>{
  for(const point of [{x:950,y:350},{x:450,y:700},{x:50,y:350},{x:450,y:30}]){
    const plan=planCatPawSweep(point,rect,80);
    expect(plan.drop.x).toBeGreaterThanOrEqual(rect.left);expect(plan.drop.x).toBeLessThanOrEqual(rect.left+rect.width);
    expect(plan.drop.y).toBeGreaterThanOrEqual(rect.top);expect(plan.drop.y).toBeLessThanOrEqual(rect.top+rect.height);
    expect(catPawPose(plan,plan.duration*.4).paw).toEqual(plan.drop);
    expect(plan.rect).toEqual(rect);
  }
});
it('keeps the forearm connected to every picture edge for distant drops and throughout the sweep',()=>{
  const large={left:100,top:100,width:3600,height:2400};
  for(const drop of [{x:800,y:1300},{x:3000,y:1300},{x:1900,y:950},{x:1900,y:1650}]){
    const plan=planCatPawSweep(drop,large,100);
    expect(plan.pawSize.width).toBe(94*2.5);
    const angle=plan.angle*Math.PI/180,inward={x:Math.sin(angle),y:-Math.cos(angle)};
    for(let i=0;i<=20;i++){
      const pose=catPawPose(plan,plan.duration*i/20);
      const reach=(pose.paw.x-plan.edge.x)*inward.x+(pose.paw.y-plan.edge.y)*inward.y;
      expect((pose.height-plan.anchor)*pose.scale-reach).toBeGreaterThanOrEqual(23.99);
      expect((plan.imageSize.height-plan.anchor)*pose.scale-reach).toBeGreaterThanOrEqual(23.99);
    }
    const contact=catPawPose(plan,plan.duration*.4);
    expect(contact.height).toBeGreaterThan(plan.pawSize.height*2);
    expect(plan.imageSize.width/plan.imageSize.height).toBeCloseTo(1024/1536);
  }
});
