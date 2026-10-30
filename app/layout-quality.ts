import {bounds,colliders,isArt,edges,entrance,type Layout,type Item} from './floor-plan';
import {rectInRoom,intersects,circleClear} from './geometry';
import type {createNavigator} from './robot-navigation';
const distance=(x:number,z:number,i:Item)=>{
 const r=bounds(i),a=r.rotation*Math.PI/180,dx=x-r.x,dz=z-r.z;
 return Math.hypot(Math.max(0,Math.abs(dx*Math.cos(a)+dz*Math.sin(a))-r.w/2),Math.max(0,Math.abs(-dx*Math.sin(a)+dz*Math.cos(a))-r.d/2));
};
export function chairClearance(layout:Layout){
 let total=0,clear=0;const obstacles=layout.items.filter(i=>!isArt(i.kind)&&i.kind!=='robot').map(i=>({i,rects:colliders([i])}));
 for(const i of layout.items.filter(i=>i.kind==='two'||i.kind==='chair')){
  const a=i.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  for(const v of(i.kind==='two'?[-1.12,1.12]:[.4])){
   const x=i.x-s*v,z=i.z+c*v;const obs=obstacles.filter(o=>o.i!==i&&Math.abs(o.i.x-x)<2.5&&Math.abs(o.i.z-z)<2.5).flatMap(o=>o.rects);
   total++;if(circleClear(x,z,obs,layout.outline,.27))clear++;
  }
 }
 return total?clear/total:1;
}
export function spatialQuality(layout:Layout,nav:ReturnType<typeof createNavigator>){
 const solid=layout.items.filter(i=>!isArt(i.kind)&&i.kind!=='robot'),entry=entrance(layout.outline);
 const exempt=[{x:entry.x+entry.nx*1.5,z:entry.z+entry.nz*1.5,w:entry.width+.6,d:3.4,rotation:entry.angle},
  ...[...nav.kitchens,...(nav.restroom?[nav.restroom]:[])].map(p=>({x:p.door.x+p.nx*1.1,z:p.door.z+p.nz*1.1,w:p.width+1.2,d:2.8,rotation:edges(layout.outline)[p.edge].angle}))];
 const walls=edges(layout.outline);
 const xs=layout.outline.map(p=>p.x),zs=layout.outline.map(p=>p.z);let free=0,wide=0,unreachable=0,emptyRadius=0,deadEnds=0,aisleExcess=0;
 const destinations=solid.filter(i=>['two','four','table','bench','checkout','serviceTable','drinkbar'].includes(i.kind));
 for(let x=Math.min(...xs)+.5;x<Math.max(...xs);x+=.5)for(let z=Math.min(...zs)+.5;z<Math.max(...zs);z+=.5){
  const sample={x,z,w:.5,d:.5,rotation:0};
  if(!rectInRoom(sample,layout.outline,.08)||exempt.some(r=>intersects(r,sample)))continue;
  const gap=Math.min(...solid.map(i=>distance(x,z,i)));if(gap<.3)continue;
  free++;const reachable=nav.reachable({x,z},.3);if(!reachable)unreachable++;if(gap>1.4)wide++;emptyRadius=Math.max(emptyRadius,gap);
  // 60 cm tiles: normal aisles 1.5–2.1 m, narrow aisles 1.2 m.
  // A free disk wider than 2.1 m is excess space, except at service entrances.
  // This is a soft ranking signal, never permission to block a chair or doorway.
  const wallGap=Math.min(...walls.map(e=>{const t=Math.max(0,Math.min(e.length,(x-e.a.x)*e.tx+(z-e.a.z)*e.tz));return Math.hypot(x-e.a.x-e.tx*t,z-e.a.z-e.tz*t);}));
  if(reachable)aisleExcess+=Math.max(0,Math.min(gap,wallGap)*2-2.1);
  // A local dead-end proxy: only one metre-long way out, away from useful
  // seat/service approaches. It is a ranking signal, not a claim of full topology.
  if(reachable&&destinations.every(i=>distance(x,z,i)>.9)){
   const exits=[[-1,0],[1,0],[0,-1],[0,1]].filter(([dx,dz])=>[.25,.5,.75,1].every(t=>nav.canMove({x:x+dx*t,z:z+dz*t}))).length;
   if(exits===1)deadEnds++;
  }
 }
 const partitions=solid.filter(i=>i.kind==='dividerWall'||i.kind==='partition'),columns=solid.filter(i=>i.kind==='pillar'),seats=solid.filter(i=>['bench','two','four'].includes(i.kind));
 const usefulWalls=partitions.filter(p=>p.id==='wc-screen'||p.id==='checkout-screen'||seats.some(s=>distance(s.x,s.z,p)<(s.kind==='bench'?.6:1.3)));
 const attached=columns.filter(c=>partitions.some(p=>intersects({...bounds(c),w:.94,d:.94},bounds(p))));
 const structure=(usefulWalls.length+attached.length)/Math.max(1,partitions.length+columns.length);
 return{deadEnds:deadEnds/Math.max(1,free),comfort:chairClearance(layout),structure,circulation:1-unreachable/Math.max(1,free),waste:wide/Math.max(1,free),usableEmptyRadius:emptyRadius,aisleExcess:aisleExcess/Math.max(1,free)};
}
