import assert from 'node:assert/strict';
import {bounds,edges,isArt,spawnPoint,CATALOG,initialLayout,parseDocument} from '../work/model-test/floor-plan.mjs';
import {rackSide} from '../work/model-test/table-arrangement.mjs';
import {assess,proposals,learn,defaultPreferences} from '../work/model-test/layout-review.mjs';
let seed=42;const random=()=>((seed=seed*16807%2147483647)-1)/2147483646;
const base=initialLayout(),results=proposals(base,defaultPreferences,random);assert(results.length>=2);
for(const p of results){parseDocument({version:2,...p.layout});assert.equal(p.assessment.blocked,0);assert(p.layout.items.some(i=>i.kind==='serviceTable'));assert.deepEqual(p.layout.outline,base.outline);}
assert(results.every((p,n)=>n===0||results[n-1].assessment.score>=p.assessment.score));
const record={choice:'A',reason:'全体の自然さ',note:'test',at:'test',a:results[0],b:{...results[1],assessment:{...results[1].assessment,density:results[0].assessment.density-.2}}};
const next=learn(defaultPreferences,record);assert.notDeepEqual(next,defaultPreferences);assert.deepEqual(learn(defaultPreferences,{...record,choice:'neither'}),defaultPreferences);
for(let n=0;n<100;n++)Object.assign(next,learn(next,record));assert(Object.values(next).every(v=>v>=.35&&v<=2.5));
const table={id:'t',kind:'four',x:0,z:0,rotation:0};
for(const turn of [0,90,180,270]){const a=turn*Math.PI/180,t={...table,rotation:turn},wall={id:'wall',kind:'partition',x:Math.cos(a)*1.2,z:Math.sin(a)*1.2,rotation:(turn+90)%360};assert.equal(rackSide(t,[t,wall],base.outline),1);}
assert.equal(parseDocument({version:2,...base}).invertX,false);assert.equal(parseDocument({version:2,...base}).invertY,false);
assert.equal(parseDocument({version:2,...base,invertX:true}).invertX,true);
console.log('PASS: ranked valid candidates, accessible supply tables, same-room A/B, bounded feedback, rejected pair does not change weights, four partition orientations, OFF/OFF defaults.');

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
