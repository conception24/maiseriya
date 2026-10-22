import {CATALOG,isArt,bounds,placementError,spawnPoint,snapArt,edges,entrance,type Layout,type Item,type Point,type Kind} from './floor-plan';
import {intersects,rectInRoom,area} from './geometry';
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
 const outline=layout.outline,items:Item[]=[],entry=entrance(outline),xs=outline.map(p=>p.x),zs=outline.map(p=>p.z),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);let serial=0;let reserved:ReturnType<typeof bounds>[]=[];const guestAisles:ReturnType<typeof bounds>[]=[];
 const add=(kind:Kind,x:number,z:number,rotation=0)=>{const i={id:`random-${serial++}`,kind,x,z,rotation};if(kind==='four'||kind==='two'){
 if(guestAisles.some(r=>intersects(bounds(i),r)))return false;
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
 // Each seating zone is a short aligned run. The open side is reserved for guests.
 const cap=Math.min(24,Math.max(4,Math.floor(area(outline)/15)));
 const guestSide=(seat:Item,side:number)=>{const a=seat.rotation*Math.PI/180,d=CATALOG[seat.kind].w/2+.48;return{x:seat.x+Math.cos(a)*d*side,z:seat.z+Math.sin(a)*d*side,w:.8,d:CATALOG[seat.kind].d,rotation:seat.rotation};};
 function seat(kind:'two'|'four',x:number,z:number,rotation:number,side:number){
  if(items.filter(i=>i.kind==='two'||i.kind==='four').length>=cap)return false;
  const next:Item={id:'check',kind,x,z,rotation},aisle=guestSide(next,side);
  if(!rectInRoom(aisle,outline,.1)||items.some(i=>!isArt(i.kind)&&intersects(aisle,bounds(i))))return false;
  if(!add(kind,x,z,rotation))return false;
  // A new row must not close the only passage into another dining room.
  const connected=createNavigator(items,outline,spawnPoint(outline,items));
  if(!items.filter(i=>i.kind==='two'||i.kind==='four').every(i=>customerSeatAccess(i,connected))){items.pop();return false;}
  guestAisles.push(aisle);return true;
 }
 const walls=edges(outline).filter(e=>Math.abs(e.angle%90)<.01&&e.length>4).sort((a,b)=>b.length-a.length);
 // Keep a consistent furniture type per run, with a cross aisle between each pair of booths.
 for(const [wallIndex,e] of walls.entries()){
  const rotation=(e.angle+90+360)%360,kind=wallIndex%3===1?'two':'four',pitch=kind==='four'?2.22:2.65;
  const offset=CATALOG[kind].w/2+.12;
  for(let n=0,t=1.35+Math.floor(random()*3)*.25;t<e.length-1.35;n++,t+=pitch+(kind==='four'&&n%2===1?1.3:0))seat(kind,e.a.x+e.tx*t+e.nx*offset,e.a.z+e.tz*t+e.nz*offset,rotation,1);
 }
 // Only large open bays receive one central, aligned pair. Never fill every remaining gap.
 for(let z=minZ+3.55+Math.floor(random()*3)*.25;z<maxZ-3;z+=5.74){
  const cuts=edges(outline).filter(e=>(e.a.z>z)!==(e.b.z>z)).map(e=>e.a.x+(z-e.a.z)*(e.b.x-e.a.x)/(e.b.z-e.a.z)).sort((a,b)=>a-b);
  for(let j=0;j+1<cuts.length;j+=2){if(cuts[j+1]-cuts[j]<10)continue;const x=(cuts[j]+cuts[j+1])/2;
   const count=items.length,aisleCount=guestAisles.length;
   if(!seat('four',x,z,0,1)||!seat('four',x,z+2.22,0,1)){items.splice(count);guestAisles.splice(aisleCount);}
  }
 }
 const spawn=spawnPoint(outline,items);
 // Recheck both bench/chair approaches from the entrance, not just a point near the table.
 const access=createNavigator(items,outline,spawn);
 for(let n=items.length-1;n>=0;n--){const i=items[n];if(!['four','two'].includes(i.kind))continue;
  if(!customerSeatAccess(i,access))items.splice(n,1);
 }
 const nav=createNavigator(items,outline,spawn);
 for(let z=maxZ-2;z>minZ+1&&items.filter(i=>i.kind==='robot').length<3;z-=1)for(let x=minX+1;x<maxX-1;x+=1){if(items.filter(i=>i.kind==='robot').length>=3)break;if(nav.route(spawn,{x,z}).length)add('robot',x,z);}
 // Screens only mark the END of a seating run, never its access side.
 let screens=0;for(const i of items.filter(i=>i.kind==='four')){if(screens>=2)break;const a=i.rotation*Math.PI/180;
  for(const sign of[-1,1]){const candidate:Item={id:`random-${serial++}`,kind:'partition',x:i.x-Math.sin(a)*1.25*sign,z:i.z+Math.cos(a)*1.25*sign,rotation:i.rotation};
   if(guestAisles.some(r=>intersects(bounds(candidate),r))||reserved.some(r=>intersects(bounds(candidate),r))||placementError(candidate,items,outline))continue;
   const next=[...items,candidate],check=createNavigator(next,outline,spawn);
   if(next.filter(t=>t.kind==='two'||t.kind==='four').every(t=>customerSeatAccess(t,check))){items.push(candidate);screens++;break;}
  }
 }
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

// Both seats/bench ends must open onto one connected, guest-sized approach strip.
export function customerSeatAccess(item:Item,nav:ReturnType<typeof createNavigator>){
 const a=item.rotation*Math.PI/180,side=CATALOG[item.kind].w/2+.48;
 return [-1,1].some(sign=>[-.72,0,.72].every(z=>nav.reachable({x:item.x+Math.cos(a)*side*sign-Math.sin(a)*z,z:item.z+Math.sin(a)*side*sign+Math.cos(a)*z},.22)));
}
