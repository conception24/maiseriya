import {CATALOG,isArt,bounds,placementError,spawnPoint,snapArt,edges,entrance,type Layout,type Item,type Point,type Kind} from './floor-plan';
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
 const outline=layout.outline,items:Item[]=[],entry=entrance(outline),xs=outline.map(p=>p.x),zs=outline.map(p=>p.z),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);let serial=0;let reserved:ReturnType<typeof bounds>[]=[];
 const add=(kind:Kind,x:number,z:number,rotation=0)=>{const i={id:`random-${serial++}`,kind,x,z,rotation};if(kind==='four'||kind==='two'){
 if(Math.abs(z)<1.885)return false;
 if(intersects(bounds(i),{x:entry.x+entry.nx*1.65,z:entry.z+entry.nz*1.65,w:3.2,d:3.3,rotation:entry.angle})||reserved.some(r=>intersects(bounds(i),r)))return false;
 // Touching booth backs must have identical centres along the bench, never a partial overlap.
 if(kind==='four'&&items.some(o=>{if(o.kind!=='four'||o.rotation%180!==rotation%180)return false;const a=rotation*Math.PI/180,dx=x-o.x,dz=z-o.z,along=Math.abs(dx*Math.cos(a)+dz*Math.sin(a)),back=Math.abs(-dx*Math.sin(a)+dz*Math.cos(a));return back<2.35&&back>2.2&&along>.01&&along<1.95;}))return false;
 }if(['four','two'].includes(kind)&&items.some(c=>['checkout','drinkbar'].includes(c.kind)&&intersects(bounds(i),{x:c.x-Math.sin(c.rotation*Math.PI/180)*.9,z:c.z+Math.cos(c.rotation*Math.PI/180)*.9,w:CATALOG[c.kind].w,d:1.1,rotation:c.rotation})))return false;if(kind==='drinkbar'&&reserved.some(r=>intersects(bounds(i),r)))return false;if(!placementError(i,items,outline)){items.push(i);return true;}return false;};
 // Reserve a checkout beside, rather than directly in, the entrance route.
 checkout:for(const e of edges(outline).filter(e=>e.i!==entry.i&&Math.abs(e.angle%90)<.01&&e.length>3).sort((a,b)=>Math.hypot((a.a.x+a.b.x)/2-entry.x,(a.a.z+a.b.z)/2-entry.z)-Math.hypot((b.a.x+b.b.x)/2-entry.x,(b.a.z+b.b.z)/2-entry.z))){
 const t=Math.max(1.5,Math.min(e.length-1.5,(entry.x-e.a.x)*e.tx+(entry.z-e.a.z)*e.tz));
 if(add('checkout',e.a.x+e.tx*t+e.nx*.95,e.a.z+e.tz*t+e.nz*.95,(e.angle+360)%360))break checkout;
 }
 const initialDoors=createNavigator(items,outline,spawnPoint(outline,items));reserved=initialDoors.kitchens.map(k=>({x:k.door.x+k.nx*.9,z:k.door.z+k.nz*.9,w:k.width+1.1,d:2,rotation:edges(outline)[k.edge].angle}));
 // A wall-side refreshment counter, with its serving side facing the room.
 bar:for(const e of edges(outline).filter(e=>Math.abs(e.angle%90)<.01&&e.i!==entry.i).sort((a,b)=>b.length-a.length))for(let t=1.5;t<e.length-1.4;t+=1.5){if(add('drinkbar',e.a.x+e.tx*t+e.nx*.55,e.a.z+e.tz*t+e.nz*.55,(e.angle+360)%360))break bar;}
 // Wall-first seating. A whole run shares one baseline and 2.22 m booth pitch.
 for(const e of edges(outline).filter(e=>Math.abs(e.angle%90)<.01&&e.length>4)){
  const rotation=(e.angle+90+360)%360;
  for(let n=0,t=1.35;t<e.length-1.2;n++,t+=2.22+(n%3===0?1.5:0)){
   const kind:Kind=n%4===0?'two':'four',offset=CATALOG[kind].w/2+.10;
   add(kind,e.a.x+e.tx*t+e.nx*offset,e.a.z+e.tz*t+e.nz*offset,rotation);
  }
 }
 // Scan each interior span separately so both wings of a connected room fill up.
 const start=minZ+2+random()*.15;
 for(let row=0,z=start;z<maxZ-1.2;row++,z+=2.22+(row%3===0?1.55:0)){
  const cuts=edges(outline).filter(e=>(e.a.z>z)!==(e.b.z>z)).map(e=>e.a.x+(z-e.a.z)*(e.b.x-e.a.x)/(e.b.z-e.a.z)).sort((a,b)=>a-b);
  for(let j=0;j+1<cuts.length;j+=2){const lo=cuts[j],hi=cuts[j+1],center=(lo+hi)/2,space=(hi-lo)/2,sideAisle=Math.min(1.55,space-.12-.92-1.695-1.84);
   if(hi-lo<5.5){for(const sign of [-1,1])add('two',center+sign*1.22,z);continue;}
   for(const sign of [-1,1])for(let n=0;n<(sideAisle>=.75?2:1);n++)add(row%3===0&&n===0?'two':'four',center+sign*(1.695+n*(1.84+sideAisle)),z);
  }
 }
 const spawn=spawnPoint(outline,items),nav=createNavigator(items,outline,spawn),reachable=new Set(nav.services.map(s=>s.tableId));for(let n=items.length-1;n>=0;n--)if(['four','two'].includes(items[n].kind)&&!reachable.has(items[n].id))items.splice(n,1);
 for(let z=maxZ-2;z>minZ+1&&items.filter(i=>i.kind==='robot').length<3;z-=1)for(let x=entry.x-1;x<=entry.x+1;x+=1){if(items.filter(i=>i.kind==='robot').length>=3)break;const q={x,z};if(nav.route(spawn,q).length)add('robot',x,z);}
 // Thin end screens beside selected booth blocks; keep every existing service route.
 let screens=0;for(const seat of [...items].filter(i=>i.kind==='four')){if(screens>=3)break;for(const sign of[-1,1]){if(add('partition',seat.x+sign*1.04,seat.z,90)){const check=createNavigator(items,outline,spawn);if(check.services.length<reachable.size)items.pop();else {screens++;break;}}}}
 // Door locations ignore artwork, so adding paintings cannot relocate an opening.
 const portals=createNavigator(items,outline,items.find(i=>i.kind==='robot')??spawn);
 const openings=[...portals.kitchens,...(portals.restroom?[portals.restroom]:[])];
 // Put the brand beside the entrance before distributing other pictures.
 for(const distance of[1.9,-1.9,2.6,-2.6,3.3,-3.3]){const logo=snapArt({id:`random-${serial++}`,kind:'logo',x:entry.x+entry.tx*distance,z:entry.z+entry.tz*distance,rotation:0},outline);if(!placementError(logo,items,outline)&&!openings.some(k=>intersects(bounds(logo),{x:k.door.x,z:k.door.z,w:k.width+.9,d:.8,rotation:edges(outline)[k.edge].angle}))){items.push(logo);break;}}

 const artworks:Kind[]=['venus','primavera','cherubs','adam','annunciation','athens'];
 const candidates:Item[]=[];
 for(const e of edges(outline))for(let t=1.7;t<e.length-1.5;t+=4.5){const art=snapArt({id:`random-${serial++}`,kind:artworks[Math.floor(random()*artworks.length)],x:e.a.x+t*e.tx,z:e.a.z+t*e.tz,rotation:0},outline);if(openings.some(k=>intersects(bounds(art),{x:k.door.x,z:k.door.z,w:k.width+.9,d:.8,rotation:edges(outline)[k.edge].angle})))continue;if(!placementError(art,items,outline))candidates.push(art);}
 const limit=Math.min(8,Math.max(3,Math.round(outline.reduce((sum,p,n)=>sum+Math.hypot(p.x-outline[(n+1)%outline.length].x,p.z-outline[(n+1)%outline.length].z),0)/14)));
 while(candidates.length&&items.filter(i=>isArt(i.kind)).length<limit){const art=candidates.splice(Math.floor(random()*candidates.length),1)[0];if(!placementError(art,items,outline))items.push(art);}
 return {...layout,items};
}
