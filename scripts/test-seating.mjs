import assert from 'node:assert/strict';
import {banquetteRun,smallTableGroups,smallGroupAccess,checkoutStaffArea} from '../work/model-test/seating-rules.mjs';
import {CATALOG,bounds,canWalk,colliders,initialLayout,parseDocument,spawnPoint,edges} from '../work/model-test/floor-plan.mjs';
import {createNavigator} from '../work/model-test/robot-navigation.mjs';
import {proposals} from '../work/model-test/layout-review.mjs';
import {intersects} from '../work/model-test/geometry.mjs';
const outline=[{x:-7,z:-8},{x:7,z:-8},{x:7,z:8},{x:-7,z:8}];
for(const rotation of[0,90,180,270]){
 const run=banquetteRun('test-run',0,0,rotation,[3,4]);
 const items=run.items,nav=createNavigator(items,outline,spawnPoint(outline,items));
 const home=spawnPoint(outline,items),planning=createNavigator(items,outline,home,{services:false});assert.deepEqual(planning.kitchens,nav.kitchens);assert.deepEqual(planning.restroom,nav.restroom);assert.deepEqual(planning.route(home,home),nav.route(home,home));assert.equal(planning.services.length,0);
 parseDocument({version:2,items,outline});assert.equal(items.filter(i=>i.kind==='bench').length,4);
 assert.deepEqual(smallTableGroups(items).map(g=>g.length),[3,4]);
 for(const group of smallTableGroups(items))assert(smallGroupAccess(group,nav));
 for(const chair of items.filter(i=>i.kind==='chair')){
  const table=items.filter(i=>i.kind==='table').sort((a,b)=>Math.hypot(a.x-chair.x,a.z-chair.z)-Math.hypot(b.x-chair.x,b.z-chair.z))[0];
  const a=chair.rotation*Math.PI/180;assert((table.x-chair.x)*Math.sin(a)-(table.z-chair.z)*Math.cos(a)>.6);
 }
 for(const bench of items.filter(i=>i.kind==='bench')){
  const table=items.filter(i=>i.kind==='table').sort((a,b)=>Math.hypot(a.x-bench.x,a.z-bench.z)-Math.hypot(b.x-bench.x,b.z-bench.z))[0];
  const a=bench.rotation*Math.PI/180;assert((table.x-bench.x)*Math.sin(a)-(table.z-bench.z)*Math.cos(a)>.8);
 }
 const front=run.aisles.at(-1),a=rotation*Math.PI/180;
 for(const t of[-.4,0,.4])assert(nav.reachable({x:front.x+Math.cos(a)*front.w*t,z:front.z+Math.sin(a)*front.w*t},.35));
 assert(nav.services.length>0&&nav.services.length<7,'some tables may use staff service while the main aisle remains traversable');
}
for(const rotation of[0,90,180,270]){const counter={id:'register',kind:'checkout',x:0,z:0,rotation};const staff=checkoutStaffArea(counter);assert(!canWalk(staff.x,staff.z,colliders([counter]),outline,.28));const a=rotation*Math.PI/180;assert(canWalk(-Math.sin(a)*.9,Math.cos(a)*.9,colliders([counter]),outline,.28));}
let seed=21;const random=()=>((seed=seed*16807%2147483647)-1)/2147483646;
const ranked=proposals(initialLayout(),undefined,random);assert(ranked.some(p=>p.layout.items.some(i=>i.kind==='bench')),'shared benches appear in standard-room candidates');
for(const {layout,assessment} of ranked){
 const nav=createNavigator(layout.items,layout.outline,spawnPoint(layout.outline,layout.items));assert.equal(assessment.blocked,0);
 const wc=nav.restroom,screen=layout.items.find(i=>i.id==='wc-screen');assert(wc&&screen);assert(Math.abs(Math.hypot(screen.x-wc.door.x,screen.z-wc.door.z)-2.65)<.001);
 for(const bar of layout.items.filter(i=>i.kind==='drinkbar'))for(const portal of nav.kitchens){const clear={x:portal.door.x+portal.nx*.9,z:portal.door.z+portal.nz*.9,w:portal.width+1.1,d:2.8,rotation:edges(layout.outline)[portal.edge].angle};assert(!intersects(bounds(bar),{...clear,w:clear.w+.8,d:clear.d+.4}));}
}
console.log('PASS: connected bench seams, 6/8-person table groups, four facing directions, guest access, robot main aisle and partial service, staff-only checkout backs, WC sight screens and kitchen/drinkbar clearance.');

const base=initialLayout(),empty=createNavigator([],base.outline,{x:0,z:5.75});
const main=empty.aisleRoute({x:0,z:5.75},{x:-5.25,z:-5});
assert(main.length>30&&main.every(p=>empty.canMove(p)));
assert(main.filter(p=>Math.min(p.x+6,6-p.x,p.z+8.5,6.5-p.z)>1.25).length/main.length>.7,'major aisle should preserve wall-side seating rather than hug the boundary');
console.log('PASS: main aisles prefer interior clearance and remain collision-safe.');

const exactTarget={x:5.15,z:-5.7},exactRoute=empty.route({x:0,z:5.75},exactTarget);assert.deepEqual(exactRoute.at(-1),exactTarget);assert(exactRoute.every(p=>empty.canMove(p)));console.log('PASS: non-grid doorway targets are reached exactly without repeated return/yield loops.');
