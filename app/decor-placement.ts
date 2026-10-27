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

