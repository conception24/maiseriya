import assert from 'node:assert/strict';
import {initialLayout,parseDocument,spawnPoint,edges} from '../work/model-test/floor-plan.mjs';
import {generatePair,layoutFingerprint,seededRandom,PLANNER_VERSION,generateReviewPair,feedbackDocument} from '../work/model-test/pair-review-model.mjs';
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

// Ordinary bench-only layouts are successful results, not "room too small".
const benchRoom={...source,outline:[{x:7,z:9},{x:-7,z:9},{x:-7,z:-2},{x:-4,z:-2},{x:-4,z:-9},{x:7,z:-9}]};
const {proposals}=await import('../work/model-test/layout-review.mjs');
const benchProposal=proposals(benchRoom,undefined,seededRandom(21))[0];
assert(benchProposal.assessment.tables>0);assert.equal(benchProposal.assessment.blocked,0);
assert(!benchProposal.layout.items.some(i=>['two','four'].includes(i.kind)));
const roomShapes=new Set(),times=[];
for(const seed of [21,1000025,2000029,3000033]){
 const start=performance.now(),p=generateReviewPair(source,seed,'varied');times.push(Math.round(performance.now()-start));
 assert.deepEqual(p.candidates[0].layout.outline,p.candidates[1].layout.outline);
 roomShapes.add(JSON.stringify(p.candidates[0].layout.outline));
 for(const c of p.candidates)assert.equal(c.assessment.blocked,0);
}
assert(roomShapes.size>=3,'questions vary the room automatically');
assert.deepEqual(generateReviewPair(source,21,'fixed').candidates[0].layout.outline,source.outline);

const {PairPrefetch}=await import('../work/model-test/pair-prefetch.mjs');
let count=0,active=0,peak=0,latest,failures=2;
const queue=new PairPrefetch(()=>{
 const id=++count;active++;peak=Math.max(peak,active);
 return{promise:Promise.resolve().then(()=>{active--;if(failures-->0)throw Error('invalid candidate');return {...pair,id:String(id)};}),cancel:()=>{}};
},status=>latest=status);
const answers=[];
for(let n=0;n<30;n++){
 const p=await queue.take();answers.push({pair:p,choice:['A','B','neither'][n%3],note:'test',at:new Date().toISOString(),view:'plan'});
}
assert.equal(new Set(answers.map(a=>a.pair.id)).size,30,'rapid answers receive unique next questions');
assert.equal(peak,1,'only one worker at once');
await queue.prepare();assert(latest.ready<=2,'bounded next-question buffer');queue.dispose();
const document=JSON.parse(JSON.stringify(feedbackDocument(answers)));
assert.equal(document.records.length,30,'one export includes every answer and both complete plans');
assert.deepEqual(document.records.map(r=>r.choice),answers.map(r=>r.choice));
let attempts=0;const broken=new PairPrefetch(()=>({promise:Promise.reject(Error('unavailable '+ ++attempts)),cancel:()=>{}}));
await assert.rejects(broken.take(),/unavailable/);assert.equal(attempts,3,'generation errors retry automatically but stop at a bound');broken.dispose();
let cancel=false,rejectPending;const cancelled=new PairPrefetch(()=>({promise:new Promise((_,reject)=>rejectPending=reject),cancel:()=>{cancel=true;rejectPending(Error('closed'));}}));
const pending=cancelled.take();cancelled.dispose();await assert.rejects(pending);assert(cancel,'closing cancels the worker');
console.log('PASS: bench-only result, varied/fixed rooms, 30 rapid answers, failed-candidate recovery, bounded prefetch, cancellation and one cumulative export. Pair times (ms): '+times.join(', '));
