import assert from 'node:assert/strict';
import {randomArrangement,randomRoom} from '../work/model-test/random-layout.mjs';
import {initialLayout,edges,entrance,spawnPoint,isArt,CATALOG} from '../work/model-test/floor-plan.mjs';
import {createNavigator} from '../work/model-test/robot-navigation.mjs';
import {recruitmentPosterSite,wallPlanterSites} from '../work/model-test/decor-placement.mjs';
let windowCases=0,withWindowBench=0,pillarCases=0,tables=0,posters=0,planterRooms=0;const times=[];
for(let seed=1;seed<=20;seed++){
 let state=seed*8917;const random=()=>((state=Math.imul(1664525,state)+1013904223>>>0)/4294967296);
 const outline=seed<=10?initialLayout().outline:randomRoom(random),start=performance.now();
 const layout=randomArrangement({...initialLayout(),outline},random);times.push(performance.now()-start);
 const nav=createNavigator(layout.items,outline,spawnPoint(outline,layout.items)),entry=entrance(outline),doors=[...nav.kitchens,...(nav.restroom?[nav.restroom]:[])];
 const windows=edges(outline).filter(e=>(e.nx<-.8||e.nz>.8)&&e.length>3&&e.i!==entry.i&&!doors.some(p=>p.edge===e.i));
 let found=false;
 for(const e of windows){const bay=e.length/Math.ceil(e.length/2.5);
  const benches=layout.items.filter(b=>b.kind==='bench'&&Math.abs(((b.rotation-e.angle+360)%360)-180)<1&&Math.abs((b.x-e.a.x)*e.nx+(b.z-e.a.z)*e.nz-.42)<.10);
  if(benches.length>=2)found=true;
  for(const b of benches){const bt=(b.x-e.a.x)*e.tx+(b.z-e.a.z)*e.tz;
   for(const art of layout.items.filter(i=>isArt(i.kind))){const distance=(art.x-e.a.x)*e.nx+(art.z-e.a.z)*e.nz,at=(art.x-e.a.x)*e.tx+(art.z-e.a.z)*e.tz;
    if(Math.abs(distance-.16)>.07)continue;
    for(let center=bay/2;center<e.length;center+=bay)assert(!(Math.abs(at-center)<(bay+CATALOG[art.kind].w)/2+.1&&Math.abs(bt-center)<(bay+CATALOG.bench.w)/2),'art blocks a bench window');
   }
  }
 }
 if(windows.length){windowCases++;if(found)withWindowBench++;}
 if(recruitmentPosterSite(layout.items,outline,doors))posters++;
 const wallPlants=wallPlanterSites(layout.items,outline,doors);assert(wallPlants.length<=6);if(wallPlants.length)planterRooms++;
 for(const p of wallPlants){assert(p.e.i!==entry.i);assert(!((p.e.nx<-.8||p.e.nz>.8)&&p.e.length>3&&!doors.some(d=>d.edge===p.e.i)),'planter mounted on a window');
  const x=p.e.a.x+p.e.tx*p.t,z=p.e.a.z+p.e.tz*p.t;
  assert(!doors.some(d=>d.edge===p.e.i&&Math.hypot(x-d.door.x,z-d.door.z)<d.width/2+.42));
  for(const art of layout.items.filter(i=>isArt(i.kind)&&i.side!=='outside')){const normal=(art.x-p.e.a.x)*p.e.nx+(art.z-p.e.a.z)*p.e.nz,along=(art.x-p.e.a.x)*p.e.tx+(art.z-p.e.a.z)*p.e.tz;if(Math.abs(normal-.16)<.12)assert(Math.abs(along-p.t)>=CATALOG[art.kind].w/2+.35-1e-8);}
 }

 const sinks=layout.items.filter(i=>i.kind==='staffSink');assert.equal(sinks.length,1,'one kitchen-side hand basin');
 assert(Math.hypot(sinks[0].x-nav.kitchens[0].door.x,sinks[0].z-nav.kitchens[0].door.z)<2.5,'hand basin near kitchen');
 assert(nav.kitchens.every(k=>nav.reachable(k.point,.35)),'kitchen remains reachable with hand basin');
 const supplies=layout.items.filter(i=>i.kind==='serviceTable'),pillars=layout.items.filter(i=>i.kind==='pillar');
 assert(supplies.length>=1&&supplies.length<=2);if(supplies.length===2)assert(Math.hypot(supplies[0].x-supplies[1].x,supplies[0].z-supplies[1].z)>=6-1e-6);
 if(supplies.some(s=>pillars.some(p=>Math.hypot(s.x-p.x,s.z-p.z)<.83)))pillarCases++;
 tables+=layout.items.filter(i=>['two','four','table'].includes(i.kind)).length;
}
assert(planterRooms>=16,`wall planters ${planterRooms}/20`);assert(posters>=16,`poster placement ${posters}/20`);assert(withWindowBench>=Math.floor(windowCases*.7),`window-side benches ${withWindowBench}/${windowCases}`);assert(pillarCases>=16,`pillar-side supply ${pillarCases}/20`);
console.log(`PASS: ${withWindowBench}/${windowCases} plans have window-side benches; ${pillarCases}/20 have a pillar-side supply table; stations 6m apart; artwork clear of occupied windows; ${posters}/20 have room for a checkout poster; ${planterRooms}/20 have clear wall planters. Mean tables ${(tables/20).toFixed(1)}, generation ${(times.reduce((a,b)=>a+b,0)/20).toFixed(0)}ms.`);

