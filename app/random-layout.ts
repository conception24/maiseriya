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
 }if(['four','two'].includes(kind)&&items.some(c=>['checkout','drinkbar','serviceTable'].includes(c.kind)&&intersects(bounds(i),{x:c.x-Math.sin(c.rotation*Math.PI/180)*.9,z:c.z+Math.cos(c.rotation*Math.PI/180)*.9,w:CATALOG[c.kind].w,d:1.1,rotation:c.rotation})))return false;if(kind==='drinkbar'&&reserved.some(r=>intersects(bounds(i),r)))return false;if(!placementError(i,items,outline)){items.push(i);return true;}return false;};
 // Reserve a checkout beside, rather than directly in, the entrance route.
 checkout:for(const e of edges(outline).filter(e=>e.i!==entry.i&&Math.abs(e.angle%90)<.01&&e.length>3).sort((a,b)=>Math.hypot((a.a.x+a.b.x)/2-entry.x,(a.a.z+a.b.z)/2-entry.z)-Math.hypot((b.a.x+b.b.x)/2-entry.x,(b.a.z+b.b.z)/2-entry.z))){
 const t=Math.max(1.5,Math.min(e.length-1.5,(entry.x-e.a.x)*e.tx+(entry.z-e.a.z)*e.tz));
 if(add('checkout',e.a.x+e.tx*t+e.nx*.95,e.a.z+e.tz*t+e.nz*.95,(e.angle+360)%360))break checkout;
 }
 const initialDoors=createNavigator(items,outline,spawnPoint(outline,items));reserved=[...initialDoors.kitchens,...(initialDoors.restroom?[initialDoors.restroom]:[])].map(k=>({x:k.door.x+k.nx*.9,z:k.door.z+k.nz*.9,w:k.width+1.1,d:2.8,rotation:edges(outline)[k.edge].angle}));
 // A wall-side refreshment counter, with its serving side facing the room.
 bar:for(const e of edges(outline).filter(e=>Math.abs(e.angle%90)<.01&&e.i!==entry.i).sort((a,b)=>b.length-a.length))for(let t=1.5;t<e.length-1.4;t+=1.5){if(add('drinkbar',e.a.x+e.tx*t+e.nx*.55,e.a.z+e.tz*t+e.nz*.55,(e.angle+360)%360))break bar;}
 // Plan a connected main aisle before placing seating. Reserve a 1.5m swept strip
 // (three robot bodies) along entrance-to-interior routes, including split rooms.
 const aisleStart=spawnPoint(outline,items),aisleNav=createNavigator(items,outline,aisleStart);
 const targets:Point[]=[];
 for(let z=minZ+2;z<maxZ-1;z+=2)for(let x=minX+2;x<maxX-1;x+=2)
  if(rectInRoom({x,z,w:2,d:2,rotation:0},outline,.1)&&aisleNav.reachable({x,z},.3))targets.push({x,z});
 const clearance=(p:Point)=>Math.min(...edges(outline).map(e=>{const t=Math.max(0,Math.min(e.length,(p.x-e.a.x)*e.tx+(p.z-e.a.z)*e.tz));return Math.hypot(p.x-e.a.x-e.tx*t,p.z-e.a.z-e.tz*t);}));
 const chosen:Point[]=[];
 for(let n=0;n<(outline.length>4?2:1)&&targets.length;n++){
  targets.sort((a,b)=>Math.min(...[aisleStart,...chosen].map(p=>Math.hypot(b.x-p.x,b.z-p.z)))*clearance(b)-Math.min(...[aisleStart,...chosen].map(p=>Math.hypot(a.x-p.x,a.z-p.z)))*clearance(a));
  const target=targets.shift()!;chosen.push(target);
  const path=aisleNav.route(aisleStart,target);
  for(let j=0;j<path.length;j+=6){const q=path[j];guestAisles.push({x:q.x,z:q.z,w:1.5,d:1.5,rotation:0});}
 }
 // Each seating zone is a short aligned run. The open side is reserved for guests.
 const cap=Math.min(32,Math.max(4,Math.floor(area(outline)/10.5)));
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
 const wallPhase=Math.floor(random()*3);if(random()<.5)walls.reverse();
 // Keep a consistent furniture type per run, with a cross aisle between each pair of booths.
 for(const [wallIndex,e] of walls.entries()){
  const rotation=(e.angle+90+360)%360,kind=(wallIndex+wallPhase)%3===1?'two':'four',pitch=kind==='four'?2.22:2.65;
  const offset=CATALOG[kind].w/2+.12;
  for(let n=0,t=1.35+Math.floor(random()*3)*.25;t<e.length-1.35;n++,t+=pitch+(kind==='four'&&n%2===1?1.3:0))seat(kind,e.a.x+e.tx*t+e.nx*offset,e.a.z+e.tz*t+e.nz*offset,rotation,1);
 }
 // Furnished islands form short internal walls. Their exposed sides remain guest aisles.
 // Try complete modules atomically, so a failed row cannot leave a stray partition behind.
 type ZoneKind='four'|'two';
 function island(x:number,z:number,rotation:number,left:ZoneKind|null,right:ZoneKind|null,corner:boolean){
  const count=(left?2:0)+(right?2:0);
  if(items.filter(i=>i.kind==='four'||i.kind==='two').length+count>cap)return false;
  const rad=rotation*Math.PI/180,c=Math.cos(rad),sn=Math.sin(rad),zone:Item[]=[],aisles:ReturnType<typeof bounds>[]=[];
  const local=(kind:Kind,u:number,v:number,turn=0):Item=>({id:`island-${serial}-${zone.length}`,kind,x:x+c*u-sn*v,z:z+sn*u+c*v,rotation:(rotation+turn)%360});
  for(const v of[-1.8,0,1.8])zone.push(local('partition',0,v,90));
  for(const [kind,side] of[[left,-1],[right,1]] as const){if(!kind)continue;
   const offset=CATALOG[kind].w/2+.08,pitch=kind==='four'?2.22:2.5;
   for(const v of[-pitch/2,pitch/2]){const i=local(kind,offset*side,v);zone.push(i);aisles.push(guestSide(i,side));}
  }
  // A return at one end makes an L, leaving the other end and the long access side open.
  if(corner){const side=right?1:-1;zone.push(local('partition',side*.918,2.718));}
  const entryClear={x:entry.x+entry.nx*1.65,z:entry.z+entry.nz*1.65,w:3.2,d:3.3,rotation:entry.angle};
  const existing=items.filter(i=>!isArt(i.kind));
  for(let n=0;n<zone.length;n++){const i=zone[n];
   if(i.kind==='four'&&[...items,...zone.slice(0,n)].some(o=>{if(o.kind!=='four'||o.rotation%180!==i.rotation%180)return false;const a=i.rotation*Math.PI/180,dx=i.x-o.x,dz=i.z-o.z,along=Math.abs(dx*Math.cos(a)+dz*Math.sin(a)),back=Math.abs(-dx*Math.sin(a)+dz*Math.cos(a));return back<2.35&&back>2.2&&along>.01&&along<1.95;}))return false;
   if(placementError(i,[...items,...zone.slice(0,n)],outline)||reserved.some(r=>intersects(bounds(i),r))||intersects(bounds(i),entryClear)||guestAisles.some(r=>intersects(bounds(i),r)))return false;
   if(existing.some(o=>['checkout','drinkbar','serviceTable'].includes(o.kind)&&intersects(bounds(i),{x:o.x-Math.sin(o.rotation*Math.PI/180)*.9,z:o.z+Math.cos(o.rotation*Math.PI/180)*.9,w:CATALOG[o.kind].w,d:1.1,rotation:o.rotation})))return false;
  }
  if(aisles.some(r=>!rectInRoom(r,outline,.1)||[...existing,...zone].some(i=>intersects(r,bounds(i)))))return false;
  const next=[...items,...zone],nav=createNavigator(next,outline,spawnPoint(outline,next));
  if(!next.filter(i=>i.kind==='two'||i.kind==='four').every(i=>customerSeatAccess(i,nav)))return false;
  items.push(...zone);guestAisles.push(...aisles);serial++;return true;
 }
 // Search the whole floor, not just its centre line. A random offset and module palette
 // change the floor plan itself; distance scoring gives the largest usable gaps priority.
 const zoneCandidates:{x:number;z:number;rotation:number;score:number}[]=[];
 const ox=Math.round(random()*2)*.45,oz=Math.round(random()*2)*.45,preferred=random()<.5?0:90;
 for(let z=minZ+2+oz;z<maxZ-2;z+=.9)for(let x=minX+2+ox;x<maxX-2;x+=.9){
  if(!rectInRoom({x,z,w:1,d:1,rotation:0},outline,.1))continue;
  const distance=Math.min(...items.filter(i=>!isArt(i.kind)).map(i=>Math.hypot(x-i.x,z-i.z)));
  for(const rotation of[preferred,90-preferred])zoneCandidates.push({x,z,rotation,score:distance+random()*.9+(rotation===preferred?.4:0)});
 }
 zoneCandidates.sort((a,b)=>b.score-a.score);
 const palettes:[ZoneKind|null,ZoneKind|null][] = random()<.5?[['four','four'],['two','four'],['four',null],[null,'two']]:[['four','two'],['four','four'],[null,'four'],['two',null]];
 const corner=random()<.65;let islands=0;
 for(const [left,right] of palettes){for(const p of zoneCandidates){if(islands>=Math.max(2,Math.ceil(area(outline)/65)))break;
  if(island(p.x,p.z,p.rotation,left,right,corner)){islands++;}
 }}
 // Fill residual dining pockets with an aligned pair of two-person tables.
 // Commit the entire pair or nothing; keep the planned aisles and chair approaches.
 for(const p of zoneCandidates){
  if(items.filter(i=>i.kind==='two'||i.kind==='four').length+2>cap)break;
  if(Math.min(...items.filter(i=>['two','four'].includes(i.kind)).map(i=>Math.hypot(i.x-p.x,i.z-p.z)))<2.2)continue;
  const a=p.rotation*Math.PI/180,dx=-Math.sin(a)*1.3,dz=Math.cos(a)*1.3;
  const before=items.length,aisleCount=guestAisles.length;
  if(seat('two',p.x-dx,p.z-dz,p.rotation,1)&&seat('two',p.x+dx,p.z+dz,p.rotation,1))continue;
  items.splice(before);guestAisles.splice(aisleCount);
 }
 // Keep a small-party option when door clearances consume the two-person run.
 if(!items.some(i=>i.kind==='two')){
  const booths=items.filter(i=>i.kind==='four');
  const single=booths.find(i=>!booths.some(j=>j!==i&&Math.hypot(i.x-j.x,i.z-j.z)<2.4))??booths.at(-1);
  if(single)single.kind='two';
 }
 // Use leftover wall/booth-end pockets, keeping the customer approach open.
 const supplyCandidates:{x:number;z:number;rotation:number;score:number}[]=[];
 const furniture=items.filter(i=>['two','four','partition'].includes(i.kind));
 for(const e of edges(outline).filter(e=>e.i!==entry.i&&Math.abs(e.angle%90)<.01))for(let t=.75;t<e.length-.75;t+=.25){
  const x=e.a.x+t*e.tx+e.nx*.53,z=e.a.z+t*e.tz+e.nz*.53,rotation=(e.angle+360)%360;
  const distance=Math.min(...furniture.map(i=>Math.hypot(x-i.x,z-i.z)));
  supplyCandidates.push({x,z,rotation,score:Math.abs(distance-1.6)});
 }
 const supplyNav=createNavigator(items,outline,spawnPoint(outline,items));
 for(const {x,z,rotation} of supplyCandidates.sort((a,b)=>a.score-b.score)){
  const i:Item={id:'supply',kind:'serviceTable',x,z,rotation},a=rotation*Math.PI/180;
  const front={x:x-Math.sin(a)*.85,z:z+Math.cos(a)*.85,w:1,d:1.05,rotation};
  if(Math.hypot(x-entry.x,z-entry.z)<3||reserved.some(r=>intersects(bounds(i),r))||guestAisles.some(r=>intersects(bounds(i),r))||!rectInRoom(front,outline,.1)||items.some(o=>intersects(front,bounds(o)))||!supplyNav.reachable(front,.3))continue;
  if(placementError(i,items,outline))continue;
  const next=[...items,i],check=createNavigator(next,outline,spawnPoint(outline,next));
  if(!next.filter(t=>['two','four'].includes(t.kind)).every(t=>customerSeatAccess(t,check)))continue;
  add('serviceTable',x,z,rotation);guestAisles.push(front);break;
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
 let screens=items.filter(i=>i.kind==='partition').length;for(const i of items.filter(i=>i.kind==='four')){if(screens>=2)break;const a=i.rotation*Math.PI/180;
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

 const behindBar=(art:Item)=>items.some(b=>b.kind==='drinkbar'&&intersects(bounds(art),{...bounds(b),d:1.3,w:3.45}));
 const artworks:Kind[]=['venus','primavera','cherubs','adam','annunciation','athens'];
 const candidates:Item[]=[];
 for(const e of edges(outline))for(let t=1.7;t<e.length-1.5;t+=4.5){const art=snapArt({id:`random-${serial++}`,kind:artworks[Math.floor(random()*artworks.length)],x:e.a.x+t*e.tx,z:e.a.z+t*e.tz,rotation:0},outline);if(openings.some(k=>intersects(bounds(art),{x:k.door.x,z:k.door.z,w:k.width+.9,d:.8,rotation:edges(outline)[k.edge].angle})))continue;if(!behindBar(art)&&!placementError(art,items,outline))candidates.push(art);}
 const limit=Math.min(8,Math.max(3,Math.round(outline.reduce((sum,p,n)=>sum+Math.hypot(p.x-outline[(n+1)%outline.length].x,p.z-outline[(n+1)%outline.length].z),0)/14)));
 while(candidates.length&&items.filter(i=>isArt(i.kind)).length<limit){const art=candidates.splice(Math.floor(random()*candidates.length),1)[0];if(!placementError(art,items,outline))items.push(art);}
 return {...layout,items};
}

// Both seats/bench ends must open onto one connected, guest-sized approach strip.
export function customerSeatAccess(item:Item,nav:ReturnType<typeof createNavigator>){
 const a=item.rotation*Math.PI/180,side=CATALOG[item.kind].w/2+.48;
 return [-1,1].some(sign=>[-.72,0,.72].every(z=>nav.reachable({x:item.x+Math.cos(a)*side*sign-Math.sin(a)*z,z:item.z+Math.sin(a)*side*sign+Math.cos(a)*z},.22)));
}
