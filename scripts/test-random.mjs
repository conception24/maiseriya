import assert from 'node:assert/strict';
import {randomArrangement,randomRoom} from '../work/model-test/random-layout.mjs';
import {rackSide} from '../work/model-test/table-arrangement.mjs';
import {initialLayout,parseDocument,spawnPoint,entrance,canWalk,colliders} from '../work/model-test/floor-plan.mjs';
import {createNavigator} from '../work/model-test/robot-navigation.mjs';
import {createFleet} from '../work/model-test/robot-fleet.mjs';
let seed=1;const random=()=>((seed=seed*16807%2147483647)-1)/2147483646;
for(let n=0;n<50;n++){const layout=randomArrangement({...initialLayout(),outline:randomRoom(random)},random);parseDocument({version:2,...layout});assert.equal(layout.items.filter(i=>i.kind==='robot').length,3);const tables=layout.items.filter(i=>i.kind==='two'||i.kind==='four');assert(layout.items.filter(i=>['venus','primavera','cherubs','adam','annunciation','athens'].includes(i.kind)).length>=8);assert(tables.some(a=>tables.some(b=>a!==b&&Math.abs(a.x-b.x)<.01&&Math.abs(Math.abs(a.z-b.z)-2.22)<.01)));assert(tables.length>=8,JSON.stringify({n,outline:layout.outline,tables}));const nav=createNavigator(layout.items,layout.outline,spawnPoint(layout.outline,layout.items));assert.equal(nav.services.length,tables.length);const checkout=layout.items.find(i=>i.kind==='checkout');assert(checkout);const entry=entrance(layout.outline);assert(Math.hypot(checkout.x-entry.x,checkout.z-entry.z)>2);assert(nav.kitchens.length>=1&&nav.kitchens.length<=2);for(const k of nav.kitchens){assert(!canWalk(k.outside.x,k.outside.z,colliders(layout.items),layout.outline));assert(k.width>=1.1&&k.depth>=1.2);}}
for(const rotation of[0,90,180,270]){const a={id:'a',kind:'wideTable',x:0,z:0,rotation},r=rotation*Math.PI/180,b={...a,id:'b',x:1.53*Math.cos(r),z:1.53*Math.sin(r)};assert.equal(rackSide(a,[a,b],initialLayout().outline),1);assert.equal(rackSide(b,[a,b],initialLayout().outline),-1);}
const l=initialLayout(),fleet=createFleet(l.items,l.outline);let moving=0,total=0;for(let n=0;n<3600;n++){const before=fleet.states();fleet.step(1/30,{x:0,z:6},false);fleet.states().forEach((r,i)=>{if(!r.hidden){total++;if(Math.hypot(r.x-before[i].x,r.z-before[i].z)>.001)moving++;}});}console.log('Movement fraction:',moving/total);assert(moving/total>.55);console.log('PASS: checkout clearance, inaccessible kitchens, 50 rooms, reachable tables, 3 robots, four paired rack orientations and movement activity.');






// The two-room plan must use both kitchen portals without robot collisions.
let calls=0;const twoRoom=randomRoom(()=>[.4,.4,.6,.8][calls++]);
const connected=randomArrangement({...initialLayout(),outline:twoRoom},random),connectedFleet=createFleet(connected.items,connected.outline),used=new Set();
assert.equal(connectedFleet.kitchens.length,2);
for(let n=0;n<9000;n++){connectedFleet.step(1/30,{x:100,z:100},false);const bots=connectedFleet.states();for(const a of bots){if(a.phase==='enter'||a.phase==='exit')for(const k of connectedFleet.kitchens)if(Math.hypot(a.x-k.door.x,a.z-k.door.z)<1)used.add(k.edge);for(const b of bots)if(a!==b&&!a.hidden&&!b.hidden)assert(Math.hypot(a.x-b.x,a.z-b.z)>=.589);}}
assert.equal(used.size,2);console.log('PASS: connected rooms, both kitchen portals used, 300-second collision simulation.');
