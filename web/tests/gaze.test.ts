import { test } from "node:test";
import assert from "node:assert/strict";
import { fit, map, targets, validProfile, readFace,eyeCoordinates,validate,validationTargets } from "../lib/gaze";
import {HeadPointer} from "../lib/head-pointer";
test("calibration recovers a known screen mapping", () => {
  const p = fit(targets.map(target => ({ features: [target.x, target.y, 0, 0], target })));
  const result = map(p, [.4, .6, 0, 0]);
  assert.ok(Math.abs(result.x - .4) < .01); assert.ok(Math.abs(result.y - .6) < .01);
});
test("calibration rejects missing or invalid samples", () => { assert.throws(() => fit([])); assert.throws(() => fit(targets.map(target => ({ target, features: [NaN, 0, 0, 0] })))); });
test("saved profiles reject corrupted storage", () => {
  assert.equal(validProfile({ x: [0], y: [0] }), false);
  assert.equal(validProfile({ x: [0, 1, 0, NaN, 0], y: [0, 0, 1, 0, 0] }), false);
  assert.equal(validProfile({ x: [0, 1, 0, 0, 0], y: [0, 0, 1, 0, 0] }), false);
  assert.equal(validProfile({version:2,x:[0,1,0,0,0],y:[0,0,1,0,0],mean:[0,0,0,0],scale:[1,1,1,1]}),true);
});
test("missing iris landmarks cannot create a gaze observation", () => { assert.equal(readFace([]), null); });
test("stationary eye features cannot create a usable calibration", () => { assert.throws(() => fit(targets.map(target => ({ target, features: [.5, .5, 0, 0] })))); });
test("eye coordinates are invariant to translation, scale and eye-line rotation",()=>{
  const a=eyeCoordinates({x:0,y:0},{x:2,y:0},{x:1.2,y:.2});
  const b=eyeCoordinates({x:3,y:4},{x:3,y:8},{x:2.6,y:6.4});
  assert.ok(Math.abs(a.x-b.x)<1e-10);assert.ok(Math.abs(a.y-b.y)<1e-10);
});
test("changing eyelid aperture does not change iris gaze features",()=>{
  const p=Array.from({length:478},()=>({x:.5,y:.5}));
  for(const [i,x,y] of [[33,.3,.4],[133,.4,.4],[362,.6,.4],[263,.7,.4],[468,.35,.42],[473,.65,.42],[159,.35,.38],[145,.35,.44],[386,.65,.38],[374,.65,.44],[234,.2,.5],[454,.8,.5],[10,.5,.1],[152,.5,.9],[1,.5,.55]])p[i]={x,y};
  const a=readFace(p)!;p[159].y=.395;p[145].y=.435;p[386].y=.395;p[374].y=.435;const b=readFace(p)!;
  assert.deepEqual(a.features,b.features);
});
test("small-amplitude eye signals are not erased by unscaled ridge penalty",()=>{
  const profile=fit(targets.map(target=>({target,features:[target.x*.01,target.y*.01,0,0]})));
  const p=map(profile,[.004,.006,0,0]);assert.ok(Math.abs(p.x-.4)<.01);assert.ok(Math.abs(p.y-.6)<.01);
});
test("independent accuracy targets reject a biased or jittery calibration",()=>{
  const p=fit(targets.map(target=>({target,features:[target.x,target.y,0,0]})));
  const samples=validationTargets.flatMap(target=>Array.from({length:24},()=>({target,features:[target.x,target.y,0,0]})));
  assert.equal(validate(p,samples).passed,true);
  assert.equal(validate(p,samples.map(s=>({...s,features:[s.features[0]+.25,s.features[1],0,0]}))).passed,false);
});
test("head pointer stays neutral, steers with head movement and ignores elapsed face-loss time",()=>{
  const h=new HeadPointer();assert.equal(h.update({x:.5,y:.5},1000),null);
  assert.equal(h.center(Array.from({length:30},()=>({x:.5,y:.5}))).passed,true);
  h.update({x:.5,y:.5},1000);assert.deepEqual(h.update({x:.502,y:.5},2000),{x:.5,y:.5});
  for(let t=2100;t<3100;t+=50)h.update({x:.45,y:.5},t);
  const p=h.update({x:.45,y:.5},3100)!;assert.ok(p.x>.5);h.lost();assert.deepEqual(h.update({x:.45,y:.5},100000),p);
});
test("head centering rejects unstable samples",()=>{
  const h=new HeadPointer();assert.equal(h.center(Array.from({length:30},(_,i)=>({x:i%2?.4:.6,y:.5}))).passed,false);
});
