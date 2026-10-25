import assert from 'node:assert/strict';
import {bounds,edges,isArt,spawnPoint,CATALOG,initialLayout,parseDocument} from '../work/model-test/floor-plan.mjs';
import {rackSide} from '../work/model-test/table-arrangement.mjs';
import {ISSUE_OPTIONS,toggleAnswer,assess,proposals,learn,defaultPreferences} from '../work/model-test/layout-review.mjs';
let seed=42;const random=()=>((seed=seed*16807%2147483647)-1)/2147483646;
const base=initialLayout(),results=proposals(base,defaultPreferences,random);assert(results.length>=2);
for(const p of results){parseDocument({version:2,...p.layout});assert.equal(p.assessment.blocked,0);assert(p.layout.items.some(i=>i.kind==='serviceTable'));assert.deepEqual(p.layout.outline,base.outline);}
assert(results.every((p,n)=>n===0||results[n-1].assessment.score>=p.assessment.score));
assert.equal(ISSUE_OPTIONS.length,20);assert.equal(new Set(ISSUE_OPTIONS.map(o=>o.id)).size,20);
const record={answers:[{id:'few-walls',label:'few walls'}],note:'test',at:'test',proposal:results[0]};
const next=learn(defaultPreferences,record);assert(next.dividers>defaultPreferences.dividers);assert.deepEqual(learn(defaultPreferences,{...record,answers:[{id:'unsure',label:'test'}]}),defaultPreferences);
assert(learn(defaultPreferences,{...record,answers:[{id:'aisles-wide',label:'test'}]}).coverage>defaultPreferences.coverage);
assert(learn(defaultPreferences,{...record,answers:[{id:'many-tables',label:'test'}]}).density<defaultPreferences.density);
assert.deepEqual(learn(defaultPreferences,{...record,answers:[{id:'toilet-seats',label:'test'}]}),defaultPreferences);
assert.equal(JSON.parse(JSON.stringify(record)).proposal.layout.items.length,results[0].layout.items.length);
for(let n=0;n<100;n++)Object.assign(next,learn(next,record));assert(Object.values(next).every(v=>v>=.35&&v<=2.5));
const wallAnswer={id:'few-walls',label:'walls'},aisleAnswer={id:'aisles-wide',label:'aisles'};
let selections=toggleAnswer([],wallAnswer);selections=toggleAnswer(selections,aisleAnswer);assert.equal(selections.length,2);
assert.equal(toggleAnswer(selections,wallAnswer).length,1);
assert.equal(toggleAnswer(selections,{id:'good',label:'good'}).length,1);
assert.equal(toggleAnswer([{id:'unsure',label:'unsure'}],wallAnswer)[0].id,'few-walls');
const combined=learn(defaultPreferences,{...record,answers:selections});assert(combined.dividers>defaultPreferences.dividers&&combined.coverage>defaultPreferences.coverage);
const exported=JSON.parse(JSON.stringify({...record,answers:[...selections,{id:'other',label:'custom issue',addOption:true}]}));assert.equal(exported.answers.length,3);assert.equal(exported.answers[2].label,'custom issue');
const table={id:'t',kind:'four',x:0,z:0,rotation:0};
for(const turn of [0,90,180,270]){const a=turn*Math.PI/180,t={...table,rotation:turn},wall={id:'wall',kind:'partition',x:Math.cos(a)*1.2,z:Math.sin(a)*1.2,rotation:(turn+90)%360};assert.equal(rackSide(t,[t,wall],base.outline),1);}
assert.equal(parseDocument({version:2,...base}).invertX,false);assert.equal(parseDocument({version:2,...base}).invertY,false);
assert.equal(parseDocument({version:2,...base,invertX:true}).invertX,true);
console.log('PASS: ranked valid candidates, accessible supply tables, single-plan answers, 20 unique issues, directional bounded feedback, four partition orientations, OFF/OFF defaults.');

assert.equal(parseDocument({version:2,...base,drinkbarStyle:'tile'}).drinkbarStyle,'tile');assert.throws(()=>parseDocument({version:2,...base,drinkbarStyle:'unknown'}));

// Opening positions remain fixed after seats, supply furniture and art are added.
const {createNavigator}=await import('../work/model-test/robot-navigation.mjs');
const {intersects}=await import('../work/model-test/geometry.mjs');
assert.equal(CATALOG.serviceTable.w,CATALOG.table.w);assert.equal(CATALOG.serviceTable.d,CATALOG.table.d);
for(const {layout} of results){
 const home=spawnPoint(layout.outline,layout.items),nav=createNavigator(layout.items,layout.outline,home);
 const architectural=createNavigator(layout.items.filter(i=>i.kind==='checkout'),layout.outline,home);
 assert.deepEqual(nav.restroom,architectural.restroom);assert.deepEqual(nav.kitchens,architectural.kitchens);
 for(const portal of [...nav.kitchens,...(nav.restroom?[nav.restroom]:[])]){
  const clear={x:portal.door.x+portal.nx*.9,z:portal.door.z+portal.nz*.9,w:portal.width+1.1,d:2.8,rotation:edges(layout.outline)[portal.edge].angle};
  assert(layout.items.filter(i=>['two','four','partition','serviceTable','drinkbar'].includes(i.kind)).every(i=>!intersects(bounds(i),clear)),'opening approach must stay clear');
 }
 for(const bar of layout.items.filter(i=>i.kind==='drinkbar'))assert(layout.items.filter(i=>isArt(i.kind)).every(i=>!intersects(bounds(i),{...bounds(bar),d:1.3,w:3.45})),'no art hidden behind drinkbar');
}
console.log('PASS: fixed kitchen/WC openings, clear approaches, no hidden drinkbar artwork, shared two-person table dimensions.');
