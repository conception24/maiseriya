import {CATALOG,bounds,edges,entrance,spawnPoint,isArt,type Item,type Point,type Rect} from './floor-plan';
import {area,intersects,rectInRoom,segmentDistance} from './geometry';
import {createNavigator} from './robot-navigation';
import {chairClearance} from './layout-quality';
import {banquetteRun,smallTableGroups,smallGroupAccess,customerSeatAccess} from './seating-rules';

// Hard priorities: service/entry space, connected access, useful structure, complete
// seating groups, then variety. Commit zones atomically; never repair by deleting chairs.
type Zone={items:Item[];aisles:Rect[];score:number};
type Nav=ReturnType<typeof createNavigator>;
const turn=(angle:number)=>(angle+360)%360;
const structuralPitch=4.52; // .82m column + two 1.84m bench/wall bays + 2cm joint.
const mainWidth=1.45,guestWidth=1.0;
export class LayoutPlanningError extends Error {}
export function planDining(outline:Point[],fixtures:Item[],reserved:Rect[],random:()=>number,attempt=0){
 const entry=entrance(outline),wallEdges=edges(outline),xs=outline.map(p=>p.x),zs=outline.map(p=>p.z);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
 const items=[...fixtures],aisles:Rect[]=[],hard=[...reserved,{x:entry.x+entry.nx*1.65,z:entry.z+entry.nz*1.65,w:entry.width,d:3.3,rotation:entry.angle}];
 const navFor=(next:Item[])=>createNavigator(next,outline,spawnPoint(outline,next),{services:false});
 const portals=navFor(items),destinations=[...portals.kitchens,...(portals.restroom?[portals.restroom]:[])].map(p=>p.point);
 const fronts=fixtures.filter(i=>['checkout','drinkbar'].includes(i.kind)).map(i=>{const a=i.rotation*Math.PI/180;return{x:i.x-Math.sin(a)*.94,z:i.z+Math.cos(a)*.94,w:CATALOG[i.kind].w,d:1.15,rotation:i.rotation};});
 hard.push(...fronts);
 let serial=0;
 const local=(x:number,z:number,rotation:number)=>{
  const a=rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return{item:(kind:Item['kind'],u:number,v:number,r=0):Item=>({id:'zone-'+serial++,kind,x:x+c*u-s*v,z:z+s*u+c*v,rotation:turn(rotation+r)}),rect:(u:number,v:number,w:number,d:number):Rect=>({x:x+c*u-s*v,z:z+s*u+c*v,w,d,rotation})};
 };
 function connected(next:Item[],nav:Nav){
  return destinations.every(p=>nav.reachable(p,.35))&&fronts.every(p=>nav.reachable(p,.3))&&
   next.filter(i=>i.kind==='serviceTable').every(i=>{const a=i.rotation*Math.PI/180;return nav.reachable({x:i.x-Math.sin(a)*.85,z:i.z+Math.cos(a)*.85},.3);})&&
   next.filter(i=>i.kind==='two'||i.kind==='four').every(i=>customerSeatAccess(i,nav))&&smallTableGroups(next).every(g=>smallGroupAccess(g,nav));
 }
 const occupied=items.filter(i=>!isArt(i.kind)).map(bounds);
 const ids=new Set(items.map(i=>i.id));
 function fits(zone:Zone){
  if(items.length+zone.items.length>138||zone.items.some(i=>ids.has(i.id)))return false;
  const stranded=zone.items.filter(i=>i.kind==='bench').some(i=>wallEdges.some(e=>{
    const b=bounds(i),r=i.rotation*Math.PI/180;
    const along=Math.abs(Math.cos(r)*e.tx+Math.sin(r)*e.tz)*b.w/2+Math.abs(-Math.sin(r)*e.tx+Math.cos(r)*e.tz)*b.d/2;
    const normal=Math.abs(Math.cos(r)*e.nx+Math.sin(r)*e.nz)*b.w/2+Math.abs(-Math.sin(r)*e.nx+Math.cos(r)*e.nz)*b.d/2;
    const t=(i.x-e.a.x)*e.tx+(i.z-e.a.z)*e.tz,gap=(i.x-e.a.x)*e.nx+(i.z-e.a.z)*e.nz-normal;
    return t+along>0&&t-along<e.length&&gap>.15&&gap<1.2;
   }));
  if(stranded)return false;
  const proposed=zone.items.map(bounds);
  // Reject occupied sites before the more expensive concave-room containment test.
  // Zones contain ordinary furniture only; the entry exclusion is already in hard.
  for(let n=0;n<proposed.length;n++){
   const b=proposed[n];
   if(hard.some(r=>intersects(b,r))||aisles.some(r=>intersects(b,r))||occupied.some(r=>intersects(b,r,-.0001))||proposed.slice(0,n).some(r=>intersects(b,r,-.0001))||!rectInRoom(b,outline,.088))return false;
  }
  return zone.aisles.every(r=>![...occupied,...proposed].some(b=>intersects(r,b,-.001))&&rectInRoom(r,outline,.09));
 }
 function commit(zone:Zone){
  if(!fits(zone))return false;
  const next=[...items,...zone.items];
  if(chairClearance({items:next,outline,chairStyle:'gray'})<.999)return false;
  const nav=navFor(next);
  if(!connected(next,nav))return false;
  for(const strip of zone.aisles){const a=strip.rotation*Math.PI/180;
   if(![-.4,0,.4].every(t=>nav.reachable({x:strip.x+Math.cos(a)*strip.w*t,z:strip.z+Math.sin(a)*strip.w*t},.3)))return false;
  }
  items.push(...zone.items);aisles.push(...zone.aisles);occupied.push(...zone.items.map(bounds));zone.items.forEach(i=>ids.add(i.id));return true;
 }
 const clearance=(p:Point)=>Math.min(...wallEdges.map(e=>segmentDistance(p,e.a,e.b)));
 const windowWalls=wallEdges.filter(e=>Math.abs(e.angle%90)<.01&&(e.nx<-.8||e.nz>.8)&&e.length>3&&e.i!==entry.i&&![...portals.kitchens,...(portals.restroom?[portals.restroom]:[])].some(p=>p.edge===e.i));
 // Favor architectural cores which leave room for a full window-side row.
 const windowOptions:Rect[]=[];
 for(const e of windowWalls)for(let t=2.05;t<=e.length-2.05;t+=1){const r={x:e.a.x+e.tx*t+e.nx*1.65,z:e.a.z+e.tz*t+e.nz*1.65,w:3.9,d:3.05,rotation:e.angle};if(rectInRoom(r,outline,.08)&&![...occupied,...hard].some(b=>intersects(r,b)))windowOptions.push(r);}
 const windowCapacity=(zone:Zone)=>{const blocked=[...zone.items.map(bounds),...zone.aisles];return windowOptions.filter(r=>!blocked.some(b=>intersects(r,b))).length;};
 function spine(x:number,z:number,rotation:number,count:number,sides:number[],tableCount:number):Zone{
  const f=local(x,z,rotation),zone:Zone={items:[],aisles:[],score:0},half=(count-1)*structuralPitch/2;
  for(let n=0;n<count;n++){const column=f.item('pillar',-half+n*structuralPitch,0);column.mirror=n===0;zone.items.push(column);}
  for(let n=0;n<count-1;n++){
   const from=-half+n*structuralPitch;
   for(const u of[from+1.33,from+3.17])zone.items.push(f.item('dividerWall',u,0));
   for(const side of sides){
    const u=from+structuralPitch/2,centre=f.rect(u,side*.412,1,1),r=turn(rotation+(side>0?180:0));
    const run=banquetteRun('banquette-core-'+serial++,centre.x,centre.z,r,[tableCount],random()<.5);
    zone.items.push(...run.items);
   }
  }
  for(const side of sides)zone.aisles.push(f.rect(0,side*3,half*2+.82,mainWidth));
  if(sides.length===1)zone.aisles.push(f.rect(0,-sides[0]*1.2,half*2+.82,guestWidth));
  return zone;
 }
 // Search whole architectural arrangements, not independent random column positions.
 const cores:Zone[]=[],preferRotation=random()<.5?0:90,preferSide=random()<.5?1:-1;
 const offsetX=Math.round(random()*2)*.25,offsetZ=Math.round(random()*2)*.25;
 for(const count of[3,4])for(const rotation of[preferRotation,90-preferRotation]){
  const along=rotation===0?maxX-minX:maxZ-minZ;if(along<(count-1)*structuralPitch+1.05)continue;
  for(let z=minZ+1.85+offsetZ;z<maxZ-1.8;z+=(attempt?.25:.5))for(let x=minX+1.85+offsetX;x<maxX-1.8;x+=(attempt?.25:.5)){
   const rad=rotation*Math.PI/180,half=(count-1)*structuralPitch/2;
   if([-half,half].some(u=>clearance({x:x+Math.cos(rad)*u,z:z+Math.sin(rad)*u})<1.8))continue;
   for(const sides of[[1,-1],[preferSide],[-preferSide]]){
    const zone=spine(x,z,rotation,count,sides,random()<.5?3:4);if(!fits(zone))continue;
    const centreDistance=Math.hypot(x-(minX+maxX)/2,z-(minZ+maxZ)/2);
    zone.score=(count-1)*sides.length*6-centreDistance*.6+(rotation===preferRotation?.4:0)+windowCapacity(zone)*3+random()*.8;
    cores.push(zone);
   }
  }
 }

 // L-shaped structural bays serve broad, shallow wings where a long spine cannot fit.
 // One inner-facing bench row uses the protected side; the other two face outer aisles.
 const preferElbow=random()<.3;
 for(const rotation of[0,90,180,270])for(let z=minZ+2;z<maxZ-2;z+=.75)for(let x=minX+2;x<maxX-2;x+=.75){
  const f=local(x,z,rotation),p=structuralPitch/2,zone:Zone={items:[],aisles:[],score:0};
  const columns=[f.item('pillar',-p,-p),f.item('pillar',p,-p),f.item('pillar',-p,p)];
  if(columns.some(i=>clearance(i)<1.8))continue;
  columns.forEach((i,n)=>{i.mirror=n===0;});zone.items.push(...columns);
  for(const t of[1.33,3.17])zone.items.push(f.item('dividerWall',-p+t,-p),f.item('dividerWall',-p,-p+t,90));
  for(const [u,v,r] of[[0,-p-.412,0],[-p-.412,0,270],[0,-p+.412,180]]){
   const q=f.rect(u,v,1,1),run=banquetteRun('banquette-elbow-'+serial++,q.x,q.z,turn(rotation+r),[4],random()<.5);zone.items.push(...run.items);
  }
  zone.aisles.push(f.rect(0,-p-3,structuralPitch+.82,mainWidth),{...f.rect(-p-3,0,structuralPitch+.82,mainWidth),rotation:turn(rotation+90)},f.rect(0,-p+3,3.68,guestWidth));
  if(fits(zone)){zone.score=(preferElbow?32:16)-Math.hypot(x-(minX+maxX)/2,z-(minZ+maxZ)/2)*.3+windowCapacity(zone)*3+random();cores.push(zone);}
 }
 cores.sort((a,b)=>b.score-a.score);
 let corePlaced=false;
 for(const zone of cores.slice(0,48))if(commit(zone)){corePlaced=true;break;}

 // A shallow U-shaped room may need a shorter seating spine and a separate pier
 // in one wing. They still share one architectural grid; the third pier includes
 // a wall-backed two-person module, never a free column in a walkway.
 if(!corePlaced){
  compact:for(const rotation of[0,90,180,270])for(let z=minZ+2;z<maxZ-2;z+=.5)for(let x=minX+2;x<maxX-2;x+=.5)for(const side of[1,-1]){
   const base=spine(x,z,rotation,2,[side],3);if(!fits(base)||base.items.filter(i=>i.kind==='pillar').some(p=>clearance(p)<1.8))continue;
   const f=local(x,z,rotation),p=structuralPitch/2;
   for(const [u,v] of[[-p,-structuralPitch],[p,-structuralPitch],[-p,structuralPitch],[p,structuralPitch],[-p-structuralPitch,0],[p+structuralPitch,0]]){
    const column=f.item('pillar',u,v);column.mirror=false;if(clearance(column)<1.8)continue;
    for(const wallTurn of[0,90,180,270])for(const facing of[1,-1]){
     const f2=local(column.x,column.z,turn(rotation+wallTurn));
     const panel=f2.item('dividerWall',1.33,0),two=f2.item('two',1.83,facing*.512,90);
     const aisle=f2.rect(1.83,facing*1.34,2.65,.7);
     const zone={items:[...base.items,column,panel,two],aisles:[...base.aisles,aisle],score:0};
     if(commit(zone)){corePlaced=true;break compact;}
    }
   }
  }
 }
 if(!corePlaced&&attempt<2)return planDining(outline,fixtures,reserved,random,attempt+1);
 if(!corePlaced)throw new LayoutPlanningError('柱・連続ベンチ席・通路を一緒に確保できません。部屋の形状を広げてください。');


 const usableWalls=wallEdges.filter(e=>Math.abs(e.angle%90)<.01&&e.length>2.5);
 // Match the walls that are actually rendered as windows, excluding service doors.
 // Reserve complete, wall-backed bench rows before optional central bays and booth rows.
 const benchWalls=new Set<number>();
 // Fill the longest feasible continuous wall run first. Tables may be separate,
 // but the backing sofa remains continuous; booths never interrupt this wall.
 for(const e of [...usableWalls].sort((a,b)=>Number(windowWalls.includes(b))-Number(windowWalls.includes(a))||b.length-a.length)){
  for(const groups of [[4,4,4],[4,4],[3,4],[2,2],[4],[3]]){
   const length=banquetteRun('measure',0,0,0,groups).length;if(e.length<length+.2)continue;
   const positions=[length/2+.1,e.length-length/2-.1];
   for(let t=length/2+.1;t<=e.length-length/2-.09;t+=.4)positions.push(t);
   for(const t of positions){
    const run=banquetteRun('banquette-window-'+serial++,e.a.x+e.tx*t+e.nx*.42,e.a.z+e.tz*t+e.nz*.42,turn(e.angle+180),groups,random()<.5);
    // Wall approaches stop at row ends; actual end access is checked in commit().
    const approaches=run.aisles.map((a,n)=>n===run.aisles.length-1?{...a,w:run.length}:a);
    if(commit({items:run.items,aisles:approaches,score:0})){benchWalls.add(e.i);break;}
   }
  }
 }
 function placeSupplies(limit:number){
 const supplies:Zone[]=[];
 // The back edge of a service table meets a column, with its accessible face
 // pointing away from that column. Prefer these over ordinary wall positions.
 for(const pillar of items.filter(i=>i.kind==='pillar'))for(const rotation of[0,90,180,270]){
  const a=rotation*Math.PI/180,nx=-Math.sin(a),nz=Math.cos(a),x=pillar.x+nx*.805,z=pillar.z+nz*.805,f=local(x,z,rotation);
  const i=f.item('serviceTable',0,0),front=f.rect(0,.95,1,1.1);
  if(Math.hypot(x-entry.x,z-entry.z)<3)continue;
  const zone={items:[i],aisles:[front],score:10+random()*.1};if(fits(zone))supplies.push(zone);
 }

 for(const e of usableWalls)for(let t=.55;t<e.length-.55;t+=.25){
  const x=e.a.x+e.tx*t+e.nx*.51,z=e.a.z+e.tz*t+e.nz*.51,rotation=turn(e.angle),f=local(x,z,rotation);
  const i=f.item('serviceTable',0,0),front=f.rect(0,.95,1,1.1);
  if(Math.hypot(x-entry.x,z-entry.z)<3)continue;
  const near=Math.min(...items.map(o=>Math.hypot(x-o.x,z-o.z)));
  const zone={items:[i],aisles:[front],score:-Math.abs(near-1.4)-Math.min(t,e.length-t)*.05};if(fits(zone))supplies.push(zone);
 }
 for(const zone of supplies.sort((a,b)=>b.score-a.score)){
  if(items.filter(i=>i.kind==='serviceTable').length>=limit)break;
  if(items.some(i=>i.kind==='serviceTable'&&Math.hypot(i.x-zone.items[0].x,i.z-zone.items[0].z)<6))continue;
  commit(zone);
 }
 }
 // Reserve one usable supply station before optional seating rows consume pockets.
 placeSupplies(1);
 if(!items.some(i=>i.kind==='serviceTable'))throw new LayoutPlanningError('調味料台と利用スペースを確保できませんでした。');

 // Extend the seating architecture into large remaining wings before perimeter rows.
 // A bay always contains its fixed backing, benches, table group and a connected aisle.
 // It is selected by usable free area; this is not the old isolated-table gap filling.
 const coreAxis=items.find(i=>i.kind==='dividerWall')!.rotation%180;
 const bankSites:{x:number;z:number;rotation:number}[]=[];
 for(let z=minZ+2;z<maxZ-2;z+=.6)for(let x=minX+2;x<maxX-2;x+=.6)
  for(const rotation of[coreAxis,90-coreAxis])bankSites.push({x,z,rotation});
 for(let pass=0;pass<Math.max(1,Math.min(6,Math.ceil(area(outline)/60)));pass++){
  const banks:Zone[]=[];
  for(const {x,z,rotation} of bankSites)for(const modules of[2,1])for(const sides of[[1,-1],[1],[-1]]){
   const f=local(x,z,rotation),zone:Zone={items:[],aisles:[],score:0};
   for(const u of(modules===2?[-.92,.92]:[0]))zone.items.push(f.item('dividerWall',u,0));
   for(const side of sides){
    const q=f.rect(0,side*.412,1,1),run=banquetteRun('banquette-bay-'+serial++,q.x,q.z,turn(rotation+(side>0?180:0)),[modules*2],random()<.5);zone.items.push(...run.items);
    zone.aisles.push(f.rect(0,side*3,modules*1.84+.5,mainWidth));
   }
   if(sides.length===1)zone.aisles.push(f.rect(0,-sides[0]*.75,modules*1.84+.5,guestWidth));
   if(!fits(zone))continue;
   const nearest=Math.min(...items.filter(i=>!isArt(i.kind)).map(i=>Math.hypot(i.x-x,i.z-z)));
   zone.score=modules*sides.length*3+Math.min(4,nearest)+(rotation===coreAxis?.8:0)+random()*.25;
   banks.push(zone);
  }
  banks.sort((a,b)=>b.score-a.score);let placed=false;
  for(const zone of banks.slice(0,24))if(commit(zone)){placed=true;break;}
  if(!placed)break;
 }
 // Every commit rechecks connected guest access. Do not freeze a temporary
 // shortest path through a still-empty seating bay as an extra exclusion.

 // Rows are complete groups with one shared approach. Corners and fixtures define
 // their endpoints; there is no scatter-fill pass for isolated interior tables.
 const wallCandidates:Zone[]=[];
 const rowPreference=random()<.5?'four':'two';
 for(const e of usableWalls.filter(e=>!benchWalls.has(e.i))){
  for(const kind of['four','two'] as const)for(const count of(kind==='four'?[4,3,2]:[3,2])){
   const pitch=kind==='four'?2.222:2.65,length=(count-1)*pitch+CATALOG[kind].d;
   if(length>e.length-.2)continue;
   const positions=[length/2+.1,e.length-length/2-.1];
   for(const other of fixtures){const t=(other.x-e.a.x)*e.tx+(other.z-e.a.z)*e.tz;positions.push(t+length/2+2,t-length/2-2);}
   for(let t=length/2+.1;t<=e.length-length/2-.1;t+=.5)positions.push(t);
   for(const t of [...new Set(positions)]){
    if(t<length/2+.09||t>e.length-length/2-.09)continue;
    const rotation=turn(e.angle+90),offset=CATALOG[kind].w/2+.1;
    const zone:Zone={items:[],aisles:[],score:0};
    for(let n=0;n<count;n++){const u=t+(n-(count-1)/2)*pitch;zone.items.push({id:'wall-row-'+serial++,kind,x:e.a.x+e.tx*u+e.nx*offset,z:e.a.z+e.tz*u+e.nz*offset,rotation});}
    zone.aisles.push({x:e.a.x+e.tx*t+e.nx*(CATALOG[kind].w+.1+guestWidth/2),z:e.a.z+e.tz*t+e.nz*(CATALOG[kind].w+.1+guestWidth/2),w:length,d:guestWidth,rotation:e.angle});
    const endGap=Math.min(t-length/2,e.length-t-length/2);
    zone.score=count*(kind==='four'?4:2)+2/(.3+endGap)+(kind===rowPreference?.7:0)+random()*.2;
    if(fits(zone))wallCandidates.push(zone);
   }
  }
 }
 wallCandidates.sort((a,b)=>b.score-a.score);
 for(const zone of wallCandidates.filter(z=>z.items[0].kind==='two'))if(commit(zone))break;
 for(const zone of wallCandidates)commit(zone);

 placeSupplies(2);
 return{items,aisles};
}

