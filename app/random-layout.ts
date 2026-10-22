import {bounds,placementError,spawnPoint,snapArt,edges,entrance,type Layout,type Item,type Point,type Kind} from './floor-plan';
import {intersects} from './geometry';
import {createNavigator} from './robot-navigation';
// Connected outlines, including two dining rooms joined by a narrow corridor.
export function randomRoom(random=Math.random):Point[]{
 const w=7+Math.floor(random()*2),d=8+Math.floor(random()*2),k=Math.floor(random()*9);
 const patterns:number[][][]=[
 [[-w,-d],[w,-d],[w,d],[-w,d]],
 [[-w+2,-d],[w-2,-d],[w,-d+2],[w,d-2],[w-2,d],[-w+2,d],[-w,d-2],[-w,-d+2]],
 [[-w,-d],[w,-d],[w,1],[1,1],[1,d],[-w,d]],
 [[-w,-d],[-2,-d],[-2,-1],[2,-1],[2,-d],[w,-d],[w,d],[-w,d]],
 [[-w,-d],[w,-d],[w,-2],[1,-2],[1,2],[w,2],[w,d],[-w,d]],
 [[-w-4,-d],[-1.5,-d],[-1.5,-1.1],[1.5,-1.1],[1.5,-d],[w+4,-d],[w+4,d],[1.5,d],[1.5,1.1],[-1.5,1.1],[-1.5,d],[-w-4,d]],
 [[-w,-d],[w,-d],[w,-1],[3.5,-1],[3.5,d],[-3.5,d],[-3.5,-1],[-w,-1]],
 [[-w,-d],[2,-d],[2,-3],[w,-3],[w,d],[-2,d],[-2,3],[-w,3]],
 [[-w,-d],[w,-d],[w,-1],[1.1,-1],[1.1,2],[w,2],[w,d+4],[-w,d+4],[-w,2],[-1.1,2],[-1.1,-1],[-w,-1]]
 ];
 let points=patterns[k].map(([x,z])=>({x,z}));if(random()<.5)points=points.map(p=>({x:-p.x,z:p.z})).reverse();return points;
}
export function randomArrangement(layout:Layout,random=Math.random):Layout{
 const outline=layout.outline,items:Item[]=[],entry=entrance(outline),xs=outline.map(p=>p.x),zs=outline.map(p=>p.z),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);let serial=0;
 const add=(kind:Kind,x:number,z:number,rotation=0)=>{const i={id:`random-${serial++}`,kind,x,z,rotation};if((kind==='four'||kind==='two')&&Math.abs(z)<1.885)return false;if(['four','two'].includes(kind)&&items.some(c=>c.kind==='checkout'&&intersects(bounds(i),{x:c.x-Math.sin(c.rotation*Math.PI/180)*.9,z:c.z+Math.cos(c.rotation*Math.PI/180)*.9,w:1.3,d:1.1,rotation:c.rotation})))return false;if(!placementError(i,items,outline)){items.push(i);return true;}return false;};
 // Reserve a checkout beside, rather than directly in, the entrance route.
 checkout:for(const depth of[2,2.8,3.5])for(const offset of[2,1.1,2.7])for(const side of (random()<.5?[-1,1]:[1,-1])){if(add('checkout',entry.x+entry.nx*depth+entry.tx*side*offset,entry.z+entry.nz*depth+entry.tz*side*offset,((Math.round(entry.angle/90)*90+side*90)%360+360)%360))break checkout;}
 // Scan each interior span separately so both wings of a connected room fill up.
 const start=minZ+2+random()*.15;
 for(let row=0,z=start;z<maxZ-1.2;row++,z+=2.22+(row%3===0?1.55:0)){
  const cuts=edges(outline).filter(e=>(e.a.z>z)!==(e.b.z>z)).map(e=>e.a.x+(z-e.a.z)*(e.b.x-e.a.x)/(e.b.z-e.a.z)).sort((a,b)=>a-b);
  for(let j=0;j+1<cuts.length;j+=2){const lo=cuts[j],hi=cuts[j+1],center=(lo+hi)/2,space=(hi-lo)/2,sideAisle=Math.min(1.55,space-.12-.92-1.695-1.84);
   if(hi-lo<5.5){for(const sign of [-1,1])add('two',center+sign*1.22,z);continue;}
   for(const sign of [-1,1])for(let n=0;n<(sideAisle>=.75?2:1);n++)add('four',center+sign*(1.695+n*(1.84+sideAisle)),z);
  }
 }
 const spawn=spawnPoint(outline,items),nav=createNavigator(items,outline,spawn),reachable=new Set(nav.services.map(s=>s.tableId));for(let n=items.length-1;n>=0;n--)if(['four','two'].includes(items[n].kind)&&!reachable.has(items[n].id))items.splice(n,1);
 for(let z=maxZ-2;z>minZ+1&&items.filter(i=>i.kind==='robot').length<3;z-=1)for(let x=entry.x-1;x<=entry.x+1;x+=1){if(items.filter(i=>i.kind==='robot').length>=3)break;const q={x,z};if(nav.route(spawn,q).length)add('robot',x,z);}
 const artworks:Kind[]=['venus','primavera','cherubs','adam','annunciation','athens'];
 for(const e of edges(outline)){for(let t=1.3;t<e.length-1.1;t+=2.5){if(e.i===entry.i&&Math.abs(t-e.length/2)<2)continue;const art=snapArt({id:`random-${serial++}`,kind:artworks[Math.floor(random()*artworks.length)],x:e.a.x+t*e.tx,z:e.a.z+t*e.tz,rotation:0},outline);if(!placementError(art,items,outline))items.push(art);}}
 return {...layout,items};
}
