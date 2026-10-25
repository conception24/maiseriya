import assert from 'node:assert/strict';
import {banquetteRun,smallTableGroups,smallGroupAccess,checkoutStaffArea} from '../work/model-test/seating-rules.mjs';
import {CATALOG,bounds,canWalk,colliders,initialLayout,parseDocument,spawnPoint,edges} from '../work/model-test/floor-plan.mjs';
import {createNavigator} from '../work/model-test/robot-navigation.mjs';
import {proposals} from '../work/model-test/layout-review.mjs';
import {intersects} from '../work/model-test/geometry.mjs';
import {randomRoom,randomArrangement} from '../work/model-test/random-layout.mjs';
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

// Every generated footprint contains connected benches whose backs touch a wall
// or the continuous wooden backing. No scoring preference may drop these seats.
const shapes=new Set();let rare=0;
for(let n=0;n<1000;n++){
 const roll=(n+.5)/1000;let calls=0;
 const room=randomRoom(()=>[.4,.4,roll,.8][calls++]);shapes.add(JSON.stringify(room));
 if(room.length===12&&room.some(p=>p.z>10))rare++;
}
assert.equal(shapes.size,17);assert.equal(rare,20,'hourglass occurs only 2% of the time');
let calls=0;const hourglass=randomRoom(()=>[.4,.4,.99,.8][calls++]);
assert(hourglass.some(p=>p.x===3.3)&&hourglass.some(p=>p.x===-3.3),'hourglass waist is 6.6m, three times the former 2.2m');
let totalRuns=0;
for(let shape=0;shape<17;shape++)for(const mirror of[.2,.8]){
 let calls=0;const roll=shape===16?.99:(shape+.5)*.98/16;
 const outline=randomRoom(()=>[.4,.4,roll,mirror][calls++]);
 const next=randomArrangement({...initialLayout(),outline},random);parseDocument({version:2,...next});
 const columns=next.items.filter(i=>i.kind==='pillar');assert(columns.length>=3&&columns.length<=4,`column count in shape ${shape}`);
 assert(columns.some(i=>i.mirror===true)&&columns.some(i=>i.mirror===false),'plain and mirror finishes both occur');
 assert.equal(CATALOG.pillar.w,CATALOG.table.w);assert.equal(CATALOG.pillar.d,CATALOG.table.w);
 for(const p of columns){
  const distance=Math.min(...edges(outline).map(e=>{const t=Math.max(0,Math.min(e.length,(p.x-e.a.x)*e.tx+(p.z-e.a.z)*e.tz));return Math.hypot(p.x-e.a.x-e.tx*t,p.z-e.a.z-e.tz*t);}));
  assert(distance>=1.8-.001,'columns must not hug the exterior wall');
  for(const other of next.items.filter(i=>i!==p&&!['robot','venus','primavera','cherubs','adam','annunciation','athens','logo'].includes(i.kind)))assert(!intersects(bounds(p),bounds(other),-.0001),'column overlaps furniture');
 }
 const loaded=parseDocument({version:2,...next});assert.deepEqual(loaded.items.filter(i=>i.kind==='pillar'),columns,'mirror finishes survive export/import');
 const benches=next.items.filter(i=>i.kind==='bench');assert(benches.length>=2,`missing continuous bench in shape ${shape}`);
 const runs=new Set(benches.map(i=>i.id.split('-bench-')[0]));totalRuns+=runs.size;
 for(const b of benches){
  const a=b.rotation*Math.PI/180,back={x:b.x-Math.sin(a)*.33,z:b.z+Math.cos(a)*.33};
  const nearOuter=edges(outline).some(e=>{const u=(back.x-e.a.x)*e.tx+(back.z-e.a.z)*e.tz;return u>=0&&u<=e.length&&Math.abs((back.x-e.a.x)*e.nx+(back.z-e.a.z)*e.nz)<.1;});
  const backing=next.items.filter(i=>i.kind==='partition'&&i.id.startsWith('banquette-wall-'));
  const nearPanel=backing.some(p=>{const dx=back.x-p.x,dz=back.z-p.z;return p.rotation===b.rotation&&Math.abs(-dx*Math.sin(a)+dz*Math.cos(a))<.025&&Math.abs(dx*Math.cos(a)+dz*Math.sin(a))<.91;});
  assert(nearOuter||nearPanel,`unsupported bench back in shape ${shape}`);
  assert(benches.some(q=>q!==b&&q.rotation===b.rotation&&Math.abs(Math.hypot(q.x-b.x,q.z-b.z)-1.84)<.001),'each bench is connected to another bench');
 }
 const nav=createNavigator(next.items,outline,spawnPoint(outline,next.items),{services:false});
 for(const g of smallTableGroups(next.items))assert(smallGroupAccess(g,nav));
}
assert(totalRuns>=60,'normally include multiple continuous bench runs');
console.log(`PASS: 17 room families in both mirror directions, wall/partition backed connected benches in every plan (${totalRuns} runs), 2% wide-waisted hourglass.`);

const badPillar={id:'bad-pillar',kind:'pillar',x:0,z:0,rotation:0,mirror:'yes'};
assert.throws(()=>parseDocument({version:2,outline,items:[badPillar]}));
assert.throws(()=>parseDocument({version:2,outline,items:[{...badPillar,kind:'chair',mirror:true}]}));
console.log('PASS: 3–4 collision-safe interior columns in all 34 plans, mixed mirror/plain finishes, table-width dimensions and validated finish persistence.');
