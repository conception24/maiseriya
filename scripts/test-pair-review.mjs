import assert from 'node:assert/strict';
import {initialLayout,parseDocument,spawnPoint,edges} from '../work/model-test/floor-plan.mjs';
import {generatePair,layoutFingerprint,seededRandom,PLANNER_VERSION} from '../work/model-test/pair-review-model.mjs';
import {randomArrangement} from '../work/model-test/random-layout.mjs';
import {createNavigator} from '../work/model-test/robot-navigation.mjs';
import {furnishingBlocksView,chooseRestroomScreen} from '../work/model-test/service-layout.mjs';
const source=initialLayout(),snapshot=JSON.stringify(source),pair=generatePair(source,21);
assert.equal(JSON.stringify(source),snapshot);
assert.equal(pair.version,PLANNER_VERSION);
assert.equal(pair.candidates.length,2);
assert.notEqual(...pair.candidates.map(c=>layoutFingerprint(c.layout)));
for(const candidate of pair.candidates){
 const {layout,seed,assessment}=candidate;
 assert.deepEqual(layout.outline,source.outline);
 assert.equal(assessment.blocked,0);assert.equal(assessment.comfort,1);
 parseDocument({version:2,...layout});
 assert.deepEqual(randomArrangement(source,seededRandom(seed)),layout,'exported seed replays exact candidate');
 const nav=createNavigator(layout.items,layout.outline,spawnPoint(layout.outline,layout.items),{services:false});
 assert.equal(nav.kitchens.length,1,'no disconnected second kitchen');
 for(const wall of edges(layout.outline)){
  const offset=i=>(i.x-wall.a.x)*wall.nx+(i.z-wall.a.z)*wall.nz;
  const along=i=>(i.x-wall.a.x)*wall.tx+(i.z-wall.a.z)*wall.tz;
  const onWall=i=>along(i)>0&&along(i)<wall.length;
  const benches=layout.items.filter(i=>i.kind==='bench'&&onWall(i)&&Math.abs(offset(i)-.42)<.01&&((i.rotation-wall.angle+360)%360)===180);
  if(benches.length)assert(!layout.items.some(i=>i.kind==='four'&&onWall(i)&&offset(i)<1.1),'booth cannot interrupt a bench wall');
 }
}
const artOnly={...pair.candidates[0].layout,items:pair.candidates[0].layout.items.map(i=>i.kind==='logo'?{...i,x:i.x+.3}:i)};
assert.equal(layoutFingerprint(artOnly),layoutFingerprint(pair.candidates[0].layout),'art-only differences do not qualify as a comparison');
const column={id:'p',kind:'pillar',x:0,z:0,rotation:0};
assert(furnishingBlocksView(column,{x:-2,z:0},{x:2,z:0}));
assert(!furnishingBlocksView(column,{x:-2,z:.6},{x:2,z:.6}),'a column does not cast a fictitious wide screen');
const bench={...column,kind:'bench'};
assert(!furnishingBlocksView(bench,{x:-2,z:0},{x:2,z:0}),'seat cushions do not obstruct seated views');
assert(furnishingBlocksView(bench,{x:-2,z:.27},{x:2,z:.27}));
const nav=createNavigator([],source.outline,spawnPoint(source.outline,[]),{services:false});
assert.equal(chooseRestroomScreen([],source.outline,nav.restroom,[...nav.kitchens,nav.restroom],[]),null,'no seats means no privacy screen needed');
console.log('PASS: distinct comparable plans, exact replay, no source mutation, usable seats, continuous wall benches, single kitchen and physical WC occluders.');
