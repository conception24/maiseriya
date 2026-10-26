import assert from 'node:assert/strict';
import {randomArrangement,randomRoom,customerSeatAccess} from '../work/model-test/random-layout.mjs';
import {proposals} from '../work/model-test/layout-review.mjs';
import {rackSide} from '../work/model-test/table-arrangement.mjs';
import {smallTableGroups,smallGroupAccess,diningCost} from '../work/model-test/seating-rules.mjs';
import {CATALOG,bounds,isArt,edges,initialLayout,parseDocument,spawnPoint,entrance,canWalk,colliders} from '../work/model-test/floor-plan.mjs';
import {createNavigator} from '../work/model-test/robot-navigation.mjs';
import {createFleet} from '../work/model-test/robot-fleet.mjs';
import {intersects,area} from '../work/model-test/geometry.mjs';
let pairedRooms=0;let seed=1;const random=()=>((seed=seed*16807%2147483647)-1)/2147483646;
for(let n=0;n<50;n++){const layout=randomArrangement({...initialLayout(),outline:randomRoom(random)},random);parseDocument({version:2,...layout});assert.equal(layout.items.filter(i=>i.kind==='robot').length,3);const tables=layout.items.filter(i=>i.kind==='two'||i.kind==='four');const arts=layout.items.filter(i=>isArt(i.kind));assert(arts.length>=2&&arts.length<=8);assert(layout.items.some(i=>i.kind==='two'));assert(layout.items.some(i=>['partition','dividerWall'].includes(i.kind)));assert(layout.items.some(i=>i.kind==='drinkbar'));if(layout.items.filter(i=>i.kind==='bench').length>=2||tables.some(a=>tables.some(b=>a!==b&&a.kind==='four'&&b.kind==='four'&&a.rotation%180===b.rotation%180&&(a.rotation%180===0?Math.abs(a.x-b.x)<.01&&Math.abs(Math.abs(a.z-b.z)-2.22)<.01:Math.abs(a.z-b.z)<.01&&Math.abs(Math.abs(a.x-b.x)-2.22)<.01))))pairedRooms++;assert(tables.length+layout.items.filter(i=>i.kind==='table').length>=Math.max(4,Math.floor(area(layout.outline)/40)),JSON.stringify({n,outline:layout.outline,tables}));const nav=createNavigator(layout.items,layout.outline,spawnPoint(layout.outline,layout.items));assert(nav.services.length>=tables.length);assert(nav.services.length<=layout.items.filter(i=>['two','four','table','wideTable'].includes(i.kind)).length);for(const group of smallTableGroups(layout.items))assert(smallGroupAccess(group,nav));assert(diningCost(layout.items)<=area(layout.outline)/7.5,'density must leave circulation and service area');for(const seat of tables)assert(customerSeatAccess(seat,nav),`blocked guest approach in room ${n}`);const doorNav=createNavigator(layout.items,layout.outline,layout.items.find(i=>i.kind==='robot'));assert(doorNav.restroom);for(const k of [...doorNav.kitchens,doorNav.restroom]){assert(!canWalk(k.outside.x,k.outside.z,colliders(layout.items),layout.outline));for(const art of arts)assert(!intersects(bounds(art),{x:k.door.x,z:k.door.z,w:k.width+.9,d:.8,rotation:edges(layout.outline)[k.edge].angle}),'art overlaps opening');}const checkout=layout.items.find(i=>i.kind==='checkout');assert(checkout);assert(Math.hypot(doorNav.kitchens[0].door.x-checkout.x,doorNav.kitchens[0].door.z-checkout.z)<4);const entry=entrance(layout.outline);const logo=layout.items.find(i=>i.kind==='logo');assert(logo&&Math.hypot(logo.x-entry.x,logo.z-entry.z)<3.5);for(const seat of tables)assert(!intersects(bounds(seat),{x:entry.x+entry.nx*1.65,z:entry.z+entry.nz*1.65,w:3.2,d:3.3,rotation:entry.angle}));for(const a of tables.filter(i=>i.kind==='four'))for(const b of tables.filter(i=>i.kind==='four'&&i!==a&&i.rotation%180===a.rotation%180)){const r=a.rotation*Math.PI/180,dx=a.x-b.x,dz=a.z-b.z,along=Math.abs(dx*Math.cos(r)+dz*Math.sin(r)),back=Math.abs(-dx*Math.sin(r)+dz*Math.cos(r));assert(!(back<2.35&&back>2.2&&along>.01&&along<1.95),'offset booth backs');}assert(Math.hypot(checkout.x-entry.x,checkout.z-entry.z)>2);assert(nav.kitchens.length>=1&&nav.kitchens.length<=2);for(const k of nav.kitchens){assert(!canWalk(k.outside.x,k.outside.z,colliders(layout.items),layout.outline));assert(k.width>=1.1&&k.depth>=1.2);}}
assert(pairedRooms>=35,`only ${pairedRooms} of 50 rooms include paired booths or shared benches`);
for(const rotation of[0,90,180,270]){const a={id:'a',kind:'wideTable',x:0,z:0,rotation},r=rotation*Math.PI/180,b={...a,id:'b',x:1.53*Math.cos(r),z:1.53*Math.sin(r)};assert.equal(rackSide(a,[a,b],initialLayout().outline),1);assert.equal(rackSide(b,[a,b],initialLayout().outline),-1);}
const l=initialLayout(),fleet=createFleet(l.items,l.outline);let moving=0,total=0;for(let n=0;n<3600;n++){const before=fleet.states();fleet.step(1/30,{x:0,z:6},false);fleet.states().forEach((r,i)=>{if(!r.hidden){total++;if(Math.hypot(r.x-before[i].x,r.z-before[i].z)>.001)moving++;}});}console.log('Movement fraction:',moving/total);assert(moving/total>.55);console.log('PASS: checkout clearance, inaccessible kitchens, 50 rooms, reachable tables, 3 robots, four paired rack orientations and movement activity.');






// The two-room plan must use both kitchen portals without robot collisions.
let calls=0;const twoRoom=randomRoom(()=>[.4,.4,.33,.8][calls++]);
const connected=randomArrangement({...initialLayout(),outline:twoRoom},random),connectedFleet=createFleet(connected.items,connected.outline),used=new Set();
assert.equal(connectedFleet.kitchens.length,2);
for(let n=0;n<9000;n++){connectedFleet.step(1/30,{x:100,z:100},false);const bots=connectedFleet.states();for(const a of bots){if(a.phase==='enter'||a.phase==='exit')for(const k of connectedFleet.kitchens)if(Math.hypot(a.x-k.door.x,a.z-k.door.z)<1)used.add(k.edge);for(const b of bots)if(a!==b&&!a.hidden&&!b.hidden)assert(Math.hypot(a.x-b.x,a.z-b.z)>=.589);}}
assert.equal(used.size,2);console.log('PASS: connected rooms, both kitchen portals used, 300-second collision simulation.');

// The player is transparent; yaw is continuous, and yielding cannot stall a fleet indefinitely.
const farPlayer=createFleet(l.items,l.outline),nearPlayer=createFleet(l.items,l.outline);
for(let n=0;n<900;n++){const before=nearPlayer.states();nearPlayer.step(1/30,before[0],false);farPlayer.step(1/30,{x:100,z:100},false);assert.deepEqual(nearPlayer.states(),farPlayer.states());for(const [i,r] of nearPlayer.states().entries())assert(Math.abs(r.yaw-before[i].yaw)<=2.8/30+.00001);}
seed=123;let longestStop=0;
for(let n=0;n<8;n++){const layout=randomArrangement({...initialLayout(),outline:randomRoom(random)},random),f=createFleet(layout.items,layout.outline),stopped=[0,0,0],distance=[0,0,0];for(let t=0;t<6000;t++){const before=f.states();f.step(.05,before[0],false);const states=f.states();states.forEach((r,i)=>{const d=Math.hypot(r.x-before[i].x,r.z-before[i].z);distance[i]+=d;stopped[i]=d>.0001||r.hidden?0:stopped[i]+.05;longestStop=Math.max(longestStop,stopped[i]);assert(stopped[i]<12,`robot ${i} stuck in room ${n}`);for(const b of states)if(b!==r&&!r.hidden&&!b.hidden)assert(Math.hypot(r.x-b.x,r.z-b.z)>=.589);});}assert(distance.every(d=>d>100));}
console.log(`PASS: transparent player, bounded turning speed, eight 300-second fleet simulations; longest stop ${longestStop.toFixed(1)}s.`);

// Repeated presses on the SAME room must change actual seating, not just artwork.
let zoneSeed=21;const zoneRandom=()=>((zoneSeed=zoneSeed*16807%2147483647)-1)/2147483646;
const signatures=new Set(),zoneShapes=new Set();
for(let n=0;n<8;n++){
 const layout=proposals(initialLayout(),undefined,zoneRandom)[0].layout,tables=layout.items.filter(i=>i.kind==='two'||i.kind==='four');
 signatures.add(JSON.stringify(layout.items.filter(i=>['two','four','table','bench','chair','dividerWall','pillar'].includes(i.kind)).map(({kind,x,z,rotation})=>({kind,x,z,rotation}))));
 const panels=layout.items.filter(i=>i.kind==='dividerWall');
 const benches=layout.items.filter(i=>i.kind==='bench');
 assert(panels.length>=3,'standard room has continuous structural seating bays');
 assert(panels.every(p=>benches.some(b=>Math.hypot(b.x-p.x,b.z-p.z)<1.1)||tables.some(t=>Math.hypot(t.x-p.x,t.z-p.z)<1.3)),'each fixed wall supports seating');
 for(const group of smallTableGroups(layout.items))zoneShapes.add(group.length);
 let largestGap=0;
 for(let z=-5;z<3;z+=.5)for(let x=-3.5;x<3.5;x+=.5){
  const clearance=Math.min(...layout.items.filter(i=>!isArt(i.kind)&&i.kind!=='robot').map(i=>{const a=i.rotation*Math.PI/180,dx=x-i.x,dz=z-i.z,b=bounds(i);return Math.hypot(Math.max(0,Math.abs(dx*Math.cos(a)+dz*Math.sin(a))-b.w/2),Math.max(0,Math.abs(-dx*Math.sin(a)+dz*Math.cos(a))-b.d/2));}));
  largestGap=Math.max(largestGap,clearance);
 }
 assert(largestGap<2.5,`oversized empty dining area: radius ${largestGap}`);
}
assert.equal(signatures.size,8);assert(zoneShapes.has(3)&&zoneShapes.has(4));
console.log('PASS: eight distinct plans for one room, continuous straight/L partitions, no oversized empty central dining area.');
