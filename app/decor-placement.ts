import {CATALOG,edges,entrance,isArt,type Item,type Point} from './floor-plan';
type Door={edge:number;door:Point;width:number};
// Select a solid-wall location near checkout, clear of door openings and art.
export function recruitmentPosterSite(items:Item[],outline:Point[],doors:Door[]){
 const checkout=items.find(i=>i.kind==='checkout');if(!checkout)return null;
 const entry=entrance(outline),choices:{e:ReturnType<typeof edges>[number];t:number;distance:number}[]=[];
 for(const e of edges(outline)){if(e.i===entry.i||e.length<1.2)continue;
  const isWindow=(e.nx<-.8||e.nz>.8)&&e.length>3&&!doors.some(d=>d.edge===e.i);if(isWindow)continue;
  for(let t=.5;t<e.length-.5;t+=.25){const x=e.a.x+e.tx*t,z=e.a.z+e.tz*t;
   if(doors.some(d=>d.edge===e.i&&Math.hypot(x-d.door.x,z-d.door.z)<d.width/2+.48))continue;
   if(items.some(i=>isArt(i.kind)&&Math.abs((i.x-e.a.x)*e.nx+(i.z-e.a.z)*e.nz-.16)<.1&&Math.abs((i.x-e.a.x)*e.tx+(i.z-e.a.z)*e.tz-t)<CATALOG[i.kind].w/2+.4))continue;
   choices.push({e,t,distance:Math.hypot(x-checkout.x,z-checkout.z)});
  }
 }
 choices.sort((a,b)=>a.distance-b.distance);return choices[0]&&choices[0].distance<5?choices[0]:null;
}

// Small wall-mounted plants fill clear gaps without covering art, doorways,
// windows, the checkout poster, or taller wall-side equipment.
export function wallPlanterSites(items:Item[],outline:Point[],doors:Door[]){
 const entry=entrance(outline),poster=recruitmentPosterSite(items,outline,doors),candidates:{e:ReturnType<typeof edges>[number];t:number;score:number}[]=[];
 for(const e of edges(outline)){if(e.i===entry.i||e.length<1.3)continue;
  if((e.nx<-.8||e.nz>.8)&&e.length>3&&!doors.some(d=>d.edge===e.i))continue;
  const art=items.filter(i=>isArt(i.kind)&&i.side!=='outside'&&Math.abs((i.x-e.a.x)*e.nx+(i.z-e.a.z)*e.nz-.16)<.12);
  for(let t=.55;t<e.length-.55;t+=.25){
   const x=e.a.x+e.tx*t,z=e.a.z+e.tz*t;
   if(doors.some(d=>d.edge===e.i&&Math.hypot(x-d.door.x,z-d.door.z)<d.width/2+.42))continue;
   if(art.some(i=>Math.abs((i.x-e.a.x)*e.tx+(i.z-e.a.z)*e.tz-t)<CATALOG[i.kind].w/2+.35))continue;
   if(poster&&poster.e.i===e.i&&Math.abs(poster.t-t)<.7)continue;
   if(items.some(i=>['staffSink','drinkbar'].includes(i.kind)&&Math.abs((i.x-e.a.x)*e.nx+(i.z-e.a.z)*e.nz)<1.2&&Math.abs((i.x-e.a.x)*e.tx+(i.z-e.a.z)*e.tz-t)<CATALOG[i.kind].w/2+.4))continue;
   const gap=art.length?Math.min(...art.map(i=>Math.abs((i.x-e.a.x)*e.tx+(i.z-e.a.z)*e.tz-t)-CATALOG[i.kind].w/2)):3;
   candidates.push({e,t,score:Math.abs(gap-.65)+(art.length?0:4)});
  }
 }
 candidates.sort((a,b)=>a.score-b.score);const result:typeof candidates=[];
 for(const c of candidates){const x=c.e.a.x+c.e.tx*c.t,z=c.e.a.z+c.e.tz*c.t;if(result.some(q=>Math.hypot(x-q.e.a.x-q.e.tx*q.t,z-q.e.a.z-q.e.tz*q.t)<3.8))continue;result.push(c);if(result.length>=3)break;}
 return result;
}

// Small square fabric panels occupy clear, solid-wall gaps between existing decor.
export function fabricPanelSites(items:Item[],outline:Point[],doors:Door[]){
 const entry=entrance(outline),plants=wallPlanterSites(items,outline,doors),poster=recruitmentPosterSite(items,outline,doors),candidates:{e:ReturnType<typeof edges>[number];t:number;score:number}[]=[];
 for(const e of edges(outline)){if(e.i===entry.i||e.length<1)continue;
  if((e.nx<-.8||e.nz>.8)&&e.length>3&&!doors.some(d=>d.edge===e.i))continue;
  const art=items.filter(i=>isArt(i.kind)&&i.side!=='outside'&&Math.abs((i.x-e.a.x)*e.nx+(i.z-e.a.z)*e.nz-.16)<.12);
  for(let t=.4;t<e.length-.4;t+=.25){const x=e.a.x+e.tx*t,z=e.a.z+e.tz*t;
   if(doors.some(d=>d.edge===e.i&&Math.hypot(x-d.door.x,z-d.door.z)<d.width/2+.35))continue;
   if(art.some(i=>Math.abs((i.x-e.a.x)*e.tx+(i.z-e.a.z)*e.tz-t)<CATALOG[i.kind].w/2+.26))continue;
   if(poster&&poster.e.i===e.i&&Math.abs(poster.t-t)<.55)continue;
   if(plants.some(p=>p.e.i===e.i&&Math.abs(p.t-t)<.58))continue;
   if(items.some(i=>['staffSink','drinkbar'].includes(i.kind)&&Math.abs((i.x-e.a.x)*e.nx+(i.z-e.a.z)*e.nz)<1.2&&Math.abs((i.x-e.a.x)*e.tx+(i.z-e.a.z)*e.tz-t)<CATALOG[i.kind].w/2+.3))continue;
   const decor=[...art.map(i=>(i.x-e.a.x)*e.tx+(i.z-e.a.z)*e.tz),...plants.filter(p=>p.e.i===e.i).map(p=>p.t)];
   const near=decor.length?Math.min(...decor.map(a=>Math.abs(a-t))):4;candidates.push({e,t,score:Math.abs(near-1.1)+(decor.length?0:3)});
  }
 }
 candidates.sort((a,b)=>a.score-b.score);const result:typeof candidates=[];
 for(const c of candidates){const x=c.e.a.x+c.e.tx*c.t,z=c.e.a.z+c.e.tz*c.t;if(result.some(q=>Math.hypot(x-q.e.a.x-q.e.tx*q.t,z-q.e.a.z-q.e.tz*q.t)<2))continue;result.push(c);if(result.length>=3)break;}
 return result;
}

