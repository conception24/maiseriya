import {CATALOG,isArt,bounds,placementError,spawnPoint,snapArt,edges,entrance,type Layout,type Item,type Point,type Kind} from './floor-plan';
import {intersects,rectInRoom,area} from './geometry';
import {banquetteRun,smallTableGroups,smallGroupAccess,diningCost,checkoutStaffArea} from './seating-rules';
import {createNavigator} from './robot-navigation';
const planningNavigator=(items:Item[],outline:Point[],home:Point)=>createNavigator(items,outline,home,{services:false});
// Sixteen everyday footprints, with a wide-waisted hourglass as a rare exception.
export function randomRoom(random=Math.random):Point[]{
 const w=6.5+Math.floor(random()*5)*.5,d=7.5+Math.floor(random()*5)*.5,roll=random(),k=roll>=.98?16:Math.floor(roll/.98*16);
 const patterns:number[][][]=[
 [[-w,-d],[w,-d],[w,d],[-w,d]],
 [[-w+2,-d],[w-2,-d],[w,-d+2],[w,d-2],[w-2,d],[-w+2,d],[-w,d-2],[-w,-d+2]],
 [[-w,-d],[w,-d],[w,1],[1,1],[1,d],[-w,d]],
 [[-w,-d],[-2,-d],[-2,-1],[2,-1],[2,-d],[w,-d],[w,d],[-w,d]],
 [[-w,-d],[w,-d],[w,-2],[1,-2],[1,2],[w,2],[w,d],[-w,d]],
 [[-w-3,-d],[-1.5,-d],[-1.5,-3.3],[1.5,-3.3],[1.5,-d],[w+3,-d],[w+3,d],[1.5,d],[1.5,3.3],[-1.5,3.3],[-1.5,d],[-w-3,d]],
 [[-w,-d],[w,-d],[w,-1],[3.5,-1],[3.5,d],[-3.5,d],[-3.5,-1],[-w,-1]],
 [[-w,-d],[2,-d],[2,-3],[w,-3],[w,d],[-2,d],[-2,3],[-w,3]],
 [[-w,-d],[w-3,-d],[w-3,-2],[w,-2],[w,d],[-w,d]],
 [[-w,-d],[w,-d],[w,d-3],[2,d-3],[2,d],[-w,d]],
 [[-w,-d],[w,-d],[w,d],[-w+3,d],[-w+3,2],[-w,2]],
 [[-w,-d],[w,-d],[w,-3],[w-2,-3],[w-2,3],[w,3],[w,d],[-w,d]],
 [[-w,-d],[w,-d],[w,d],[2,d],[2,d-2],[-2,d-2],[-2,d],[-w,d]],
 [[-w,-d],[w-2,-d],[w-2,-d+2],[w,-d+2],[w,d],[-w+2,d],[-w+2,d-2],[-w,d-2]],
 [[-w,-d],[1,-d],[1,-d+3],[w,-d+3],[w,d],[-1,d],[-1,d-3],[-w,d-3]],
 [[-w,-d],[w,-d],[w,d-4],[w-3,d-4],[w-3,d],[-w+3,d],[-w+3,d-4],[-w,d-4]],
 [[-w,-d],[w,-d],[w,-1],[3.3,-1],[3.3,2],[w,2],[w,d+3],[-w,d+3],[-w,2],[-3.3,2],[-3.3,-1],[-w,-1]]
 ];
 let points=patterns[k].map(([x,z])=>({x,z}));if(random()<.5)points=points.map(p=>({x:-p.x,z:p.z})).reverse();return points;
}
export function randomArrangement(layout:Layout,random=Math.random,attempt=0):Layout{
 const outline=layout.outline,items:Item[]=[],entry=entrance(outline),xs=outline.map(p=>p.x),zs=outline.map(p=>p.z),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);let serial=0;let reserved:ReturnType<typeof bounds>[]=[];const guestAisles:ReturnType<typeof bounds>[]=[];
 const add=(kind:Kind,x:number,z:number,rotation=0)=>{const i={id:`random-${serial++}`,kind,x,z,rotation};if(kind==='four'||kind==='two'){
 if(guestAisles.some(r=>intersects(bounds(i),r)))return false;
 if(intersects(bounds(i),{x:entry.x+entry.nx*1.65,z:entry.z+entry.nz*1.65,w:3.2,d:3.3,rotation:entry.angle})||reserved.some(r=>intersects(bounds(i),r)))return false;
 // Touching booth backs must have identical centres along the bench, never a partial overlap.
 if(kind==='four'&&items.some(o=>{if(o.kind!=='four'||o.rotation%180!==rotation%180)return false;const a=rotation*Math.PI/180,dx=x-o.x,dz=z-o.z,along=Math.abs(dx*Math.cos(a)+dz*Math.sin(a)),back=Math.abs(-dx*Math.sin(a)+dz*Math.cos(a));return back<2.35&&back>2.2&&along>.01&&along<1.95;}))return false;
 }if(['four','two'].includes(kind)&&items.some(c=>['checkout','drinkbar','serviceTable'].includes(c.kind)&&intersects(bounds(i),{x:c.x-Math.sin(c.rotation*Math.PI/180)*.9,z:c.z+Math.cos(c.rotation*Math.PI/180)*.9,w:CATALOG[c.kind].w,d:1.1,rotation:c.rotation})))return false;if(kind==='drinkbar'){const a=rotation*Math.PI/180,front={x:x-Math.sin(a)*.9,z:z+Math.cos(a)*.9,w:3.2,d:1.1,rotation};if(reserved.some(r=>intersects(bounds(i),{...r,w:r.w+.8,d:r.d+.4})||intersects(front,r)))return false;}if(!placementError(i,items,outline)){items.push(i);return true;}return false;};
 // Reserve a checkout beside, rather than directly in, the entrance route.
 checkout:for(const e of edges(outline).filter(e=>e.i!==entry.i&&Math.abs(e.angle%90)<.01&&e.length>3).sort((a,b)=>Math.hypot((a.a.x+a.b.x)/2-entry.x,(a.a.z+a.b.z)/2-entry.z)-Math.hypot((b.a.x+b.b.x)/2-entry.x,(b.a.z+b.b.z)/2-entry.z))){
 const t=Math.max(1.5,Math.min(e.length-1.5,(entry.x-e.a.x)*e.tx+(entry.z-e.a.z)*e.tz));
 if(add('checkout',e.a.x+e.tx*t+e.nx*1.05,e.a.z+e.tz*t+e.nz*1.05,(e.angle+360)%360))break checkout;
 }
 const initialDoors=planningNavigator(items,outline,spawnPoint(outline,items));reserved=[...initialDoors.kitchens,...(initialDoors.restroom?[initialDoors.restroom]:[])].map(k=>({x:k.door.x+k.nx*.9,z:k.door.z+k.nz*.9,w:k.width+1.1,d:2.8,rotation:edges(outline)[k.edge].angle}));
 reserved.push(...items.filter(i=>i.kind==='checkout').map(checkoutStaffArea));
 const checkout=items.find(i=>i.kind==='checkout');
 if(checkout){const a=checkout.rotation*Math.PI/180,c=Math.cos(a),sn=Math.sin(a),side=(entry.x-checkout.x)*c+(entry.z-checkout.z)*sn>0?1:-1;
  for(const sign of[side,-side]){const panel:Item={id:'checkout-screen',kind:'partition',x:checkout.x+c*.82*sign-sn*.08,z:checkout.z+sn*.82*sign+c*.08,rotation:(checkout.rotation+90)%360};if(!reserved.some(r=>intersects(bounds(panel),r))&&!placementError(panel,items,outline)){items.push(panel);serial++;break;}}
 }
 // A sight screen faces the WC opening; guests can enter around either end.
 const wc=initialDoors.restroom;
 if(wc){const wall=edges(outline)[wc.edge],screen:Item={id:'wc-screen',kind:'partition',x:wc.door.x+wc.nx*2.65,z:wc.door.z+wc.nz*2.65,rotation:(Math.round(wall.angle/90)*90+360)%360};
  if(!placementError(screen,items,outline)&&!reserved.some(r=>intersects(bounds(screen),r))){items.push(screen);serial++;}
 }
 // A wall-side refreshment counter, with its serving side facing the room.
 bar:for(const e of edges(outline).filter(e=>Math.abs(e.angle%90)<.01&&e.i!==entry.i).sort((a,b)=>b.length-a.length))for(let t=1.5;t<e.length-1.4;t+=1.5){if(add('drinkbar',e.a.x+e.tx*t+e.nx*.55,e.a.z+e.tz*t+e.nz*.55,(e.angle+360)%360))break bar;}
 // Plan a connected main aisle before placing seating. Reserve a 1.35m swept strip
 // along entrance-to-interior routes, including split rooms.
 const aisleStart=spawnPoint(outline,items),aisleNav=planningNavigator(items,outline,aisleStart);
 const targets:Point[]=[];
 for(let z=minZ+2;z<maxZ-1;z+=2)for(let x=minX+2;x<maxX-1;x+=2)
  if(rectInRoom({x,z,w:2,d:2,rotation:0},outline,.1)&&aisleNav.reachable({x,z},.3))targets.push({x,z});
 const clearance=(p:Point)=>Math.min(...edges(outline).map(e=>{const t=Math.max(0,Math.min(e.length,(p.x-e.a.x)*e.tx+(p.z-e.a.z)*e.tz));return Math.hypot(p.x-e.a.x-e.tx*t,p.z-e.a.z-e.tz*t);}));
 // Entrances to service areas are major routes, unlike individual table approaches.
 for(const portal of [...initialDoors.kitchens,...(initialDoors.restroom?[initialDoors.restroom]:[])]){
  const path=aisleNav.aisleRoute(aisleStart,portal.point);for(let j=0;j<path.length;j+=4){const q=path[j];guestAisles.push({x:q.x,z:q.z,w:1.35,d:1.35,rotation:0});}
 }
 const chosen:Point[]=[];
 for(let n=0;n<(outline.length>4?2:1)&&targets.length;n++){
  targets.sort((a,b)=>Math.min(...[aisleStart,...chosen].map(p=>Math.hypot(b.x-p.x,b.z-p.z)))*clearance(b)-Math.min(...[aisleStart,...chosen].map(p=>Math.hypot(a.x-p.x,a.z-p.z)))*clearance(a));
  const target=targets.shift()!;chosen.push(target);
  const path=aisleNav.aisleRoute(aisleStart,target);
  for(let j=0;j<path.length;j+=6){const q=path[j];guestAisles.push({x:q.x,z:q.z,w:1.35,d:1.35,rotation:0});}
 }
 const mainAisleCount=guestAisles.length;
 // Each seating zone is a short aligned run. The open side is reserved for guests.
 const cap=Math.min(32,Math.max(4,Math.floor(area(outline)/10.5)));
 const guestSide=(seat:Item,side:number)=>{const a=seat.rotation*Math.PI/180,d=CATALOG[seat.kind].w/2+.4;return{x:seat.x+Math.cos(a)*d*side,z:seat.z+Math.sin(a)*d*side,w:.7,d:CATALOG[seat.kind].d,rotation:seat.rotation};};
 function seat(kind:'two'|'four',x:number,z:number,rotation:number,side:number){
  if(diningCost(items)+1>cap)return false;
  const next:Item={id:'check',kind,x,z,rotation},aisle=guestSide(next,side);
  if(!rectInRoom(aisle,outline,.1)||items.some(i=>!isArt(i.kind)&&intersects(aisle,bounds(i))))return false;
  if(!add(kind,x,z,rotation))return false;
  // A new row must not close the only passage into another dining room.
  const connected=planningNavigator(items,outline,spawnPoint(outline,items));
  if(!items.filter(i=>i.kind==='two'||i.kind==='four').every(i=>customerSeatAccess(i,connected))||!smallTableGroups(items).every(g=>smallGroupAccess(g,connected))){items.pop();return false;}
  guestAisles.push(aisle);return true;
 }
 const walls=edges(outline).filter(e=>Math.abs(e.angle%90)<.01&&e.length>4).sort((a,b)=>b.length-a.length);
 // 連続ベンチ席: reserve these first, so ordinary booth rows cannot crowd them out.
 // Backrests follow an exterior wall; the table groups and seams remain independent.
 let benchRuns=0;
 const runTarget=Math.min(4,Math.max(2,Math.floor(area(outline)/110)));
 function placeBenchRun(x:number,z:number,rotation:number,groups:number[],backing=false){
  const run=banquetteRun(`banquette-${serial++}`,x,z,rotation,groups);
  if(diningCost(items)+groups.reduce((n,c)=>n+c/2,0)>cap)return false;
  const zone=[...run.items];
  if(backing){const a=rotation*Math.PI/180,c=Math.cos(a),sn=Math.sin(a),count=Math.ceil(run.length/1.8);
   for(let n=0;n<count;n++){const u=(n-(count-1)/2)*1.8;zone.push({id:`banquette-wall-${serial}-${n}`,kind:'partition',x:x+c*u-sn*.348,z:z+sn*u+c*.348,rotation});}
  }
  const entryClear={x:entry.x+entry.nx*1.65,z:entry.z+entry.nz*1.65,w:3.2,d:3.3,rotation:entry.angle};
  if(zone.some((i,n)=>placementError(i,[...items,...zone.slice(0,n)],outline)||reserved.some(r=>intersects(bounds(i),r))||guestAisles.some(r=>intersects(bounds(i),r))||intersects(bounds(i),entryClear)))return false;
  if(run.aisles.some(r=>!rectInRoom(r,outline,.1)||[...items,...zone].some(i=>!isArt(i.kind)&&intersects(r,bounds(i)))))return false;
  const next=[...items,...zone],check=planningNavigator(next,outline,spawnPoint(outline,next));
  if(!next.filter(t=>['two','four'].includes(t.kind)).every(t=>customerSeatAccess(t,check))||!smallTableGroups(next).every(g=>smallGroupAccess(g,check)))return false;
  const front=run.aisles.at(-1)!,a=rotation*Math.PI/180;
  if(![-.4,0,.4].every(t=>check.reachable({x:front.x+Math.cos(a)*front.w*t,z:front.z+Math.sin(a)*front.w*t},.35)))return false;
  // Keep counter fronts usable as well as the main aisle.
  if(![...initialDoors.kitchens,...(initialDoors.restroom?[initialDoors.restroom]:[])].every(k=>check.reachable(k.point,.35)))return false;
  items.push(...zone);guestAisles.push(...run.aisles);benchRuns++;return true;
 }
 const benchWalls=walls.map(e=>({e,score:e.length+random()*2})).sort((a,b)=>b.score-a.score).map(p=>p.e);
 const largeGroups=random()<.5?[3,4]:[4,3];
 for(const groups of[largeGroups,[4],[3]]){
  for(const e of benchWalls){if(benchRuns>=runTarget||(groups===largeGroups&&outline.length>4&&benchRuns>=1))break;
   const length=Math.ceil((groups.reduce((n,c)=>n+c*.82,0)+(groups.length-1)*1.15)/1.84)*1.84;
   const start=length/2+.2,end=e.length-length/2-.2;if(start>end)continue;
   const positions=[];for(let t=start;t<=end+.001;t+=.6)positions.push(t);
   if(random()<.5)positions.reverse();
   for(const t of positions)if(placeBenchRun(e.a.x+e.tx*t+e.nx*.42,e.a.z+e.tz*t+e.nz*.42,(e.angle+180+360)%360,groups))break;
  }
  if(benchRuns>=runTarget)break;
 }
 // Interior runs have a continuous wooden backing, never a free-floating bench back.
 if(benchRuns<runTarget){
  search:for(let z=minZ+3;z<maxZ-3;z+=1.2)for(let x=minX+3;x<maxX-3;x+=1.2)for(const rotation of[0,90,180,270]){
   if(placeBenchRun(x,z,rotation,[3],true)&&benchRuns>=runTarget)break search;
  }
 }
 if(!benchRuns)throw new Error('連続ベンチ席と通路を確保できません。部屋を広げてください。');
 // Treat columns as one orthogonal structural grid, rather than unrelated objects.
 // Each grid node includes an attached partition, usable as an aisle/seat boundary.
 const columnCount=random()<.5?3:4,columnOffsetX=random()*.5,columnOffsetZ=random()*.5;
 type ColumnNode={ix:number;iz:number;column:Item;panels:Item[];score:number};
 const columnNodes:ColumnNode[]=[],nodeMap=new Map<string,ColumnNode>();
 const entryClear={x:entry.x+entry.nx*1.65,z:entry.z+entry.nz*1.65,w:3.2,d:3.3,rotation:entry.angle};
 const moduleFits=(i:Item)=>!placementError(i,items,outline)&&!reserved.some(r=>intersects(bounds(i),r))&&!(attempt===0?guestAisles:guestAisles.slice(mainAisleCount)).some(r=>intersects(bounds(i),r))&&!intersects(bounds(i),entryClear);
 for(let iz=0,z=minZ+1.8+columnOffsetZ;z<maxZ-1.8;iz++,z+=.5)for(let ix=0,x=minX+1.8+columnOffsetX;x<maxX-1.8;ix++,x+=.5){
  if(clearance({x,z})<1.8)continue;
  const column:Item={id:`column-${ix}-${iz}`,kind:'pillar',x,z,rotation:0};if(!moduleFits(column))continue;
  const panels:Item[]=[];
  for(const [dx,dz,rotation] of[[1,0,0],[-1,0,0],[0,1,90],[0,-1,90]]){
   const panel:Item={id:`column-wall-${ix}-${iz}`,kind:'partition',x:x+dx*1.31,z:z+dz*1.31,rotation};
   if(moduleFits(panel)&&!placementError(panel,[...items,column],outline))panels.push(panel);
  }
  if(!panels.length)continue;
  const node={ix,iz,column,panels,score:random()+Math.min(3,clearance(column))*.15};
  columnNodes.push(node);nodeMap.set(`${ix},${iz}`,node);
 }
 const patterns:{nodes:ColumnNode[];score:number}[]=[];
 const pitches=[7,8,9,10,11,12,6,5,13,14,15,16,17,18,19,20]; // Common structural bays, including larger spans between separate wings.
 for(const node of columnNodes)for(const dx of pitches){
  for(const count of[columnCount,3])for(const [sx,sz] of[[1,0],[0,1]]){
   const nodes=Array.from({length:count},(_,n)=>nodeMap.get(`${node.ix+n*dx*sx},${node.iz+n*dx*sz}`));
   if(nodes.every(n=>n))patterns.push({nodes:nodes as ColumnNode[],score:nodes.reduce((n,q)=>n+q!.score,0)/count+random()*.3});
  }
  for(const dz of pitches){const corners=[[0,0],[dx,0],[0,dz],[dx,dz]].map(([x,z])=>nodeMap.get(`${node.ix+x},${node.iz+z}`));
   if(columnCount===4&&corners.every(n=>n))patterns.push({nodes:corners as ColumnNode[],score:corners.reduce((n,q)=>n+q!.score,0)/4+random()*.3});
   for(let missing=0;missing<4;missing++){const nodes=corners.filter((_,n)=>n!==missing);if(nodes.every(n=>n))patterns.push({nodes:nodes as ColumnNode[],score:nodes.reduce((n,q)=>n+q!.score,0)/3+random()*.3});}
  }
 }
 patterns.sort((a,b)=>b.nodes.length-a.nodes.length||b.score-a.score);
 let columns:Item[]=[],columnPanels:Item[]=[];
 for(const pattern of patterns){
  // Choose attachments together, preventing partitions at one node from clipping another.
  const bases=pattern.nodes.map(n=>n.column),zone=[...bases];
  function attach(n:number):boolean{
   if(n===pattern.nodes.length)return true;
   for(const panel of pattern.nodes[n].panels){if(placementError(panel,[...items,...zone],outline))continue;zone.push(panel);if(attach(n+1))return true;zone.pop();}return false;
  }
  if(!attach(0))continue;
  const next=[...items,...zone],check=planningNavigator(next,outline,spawnPoint(outline,next));
  if(![...initialDoors.kitchens,...(initialDoors.restroom?[initialDoors.restroom]:[])].every(k=>check.reachable(k.point,.35))||!smallTableGroups(next).every(g=>smallGroupAccess(g,check)))continue;
  columns=bases;columnPanels=zone.slice(bases.length);items.push(...zone);break;
 }
 if(columns.length<3){if(attempt<2)return randomArrangement(layout,random,attempt+1);throw new Error('柱と仕切りを整列させるスペースが足りません。部屋を広げてください。');}
 // In tight wings, reroute the main corridor around the structural grid rather
 // than distorting the grid to follow an earlier provisional route.
 if(attempt>0){
  const start=spawnPoint(outline,items),nav=planningNavigator(items,outline,start),routes:ReturnType<typeof bounds>[]=[];
  for(const target of[...initialDoors.kitchens.map(k=>k.point),...(initialDoors.restroom?[initialDoors.restroom.point]:[]),...chosen]){
   const path=nav.aisleRoute(start,target);for(let n=0;n<path.length;n+=4)routes.push({x:path[n].x,z:path[n].z,w:1.35,d:1.35,rotation:0});
  }
  guestAisles.splice(0,mainAisleCount,...routes);
 }
 const mirrorCount=Math.max(1,Math.min(columns.length-1,Math.round(columns.length*random()*.75)));
 columns.forEach((column,n)=>{column.mirror=n<mirrorCount;});
 // Let each attached partition organize seating where the customer approach fits.
 // A clear side remains available when a column marks only an aisle boundary.
 for(const panel of columnPanels){
  const a=panel.rotation*Math.PI/180,c=Math.cos(a),sn=Math.sin(a);
  const column=columns.find(i=>i.id===panel.id.replace('column-wall-','column-'))!;
  const end=(panel.x-column.x)*c+(panel.z-column.z)*sn>0?1:-1;
  const firstSide=random()<.5?1:-1;
  seating:for(const kind of['four','two'] as const)for(const sign of[firstSide,-firstSide]){
   const offset=CATALOG[kind].d/2+.02;
   if(seat(kind,panel.x+c*.04*end-sn*offset*sign,panel.z+sn*.04*end+c*offset*sign,panel.rotation,end))break seating;
  }
 }
 const wallPhase=Math.floor(random()*3);if(random()<.5)walls.reverse();
 // Keep a consistent furniture type per run, with a cross aisle between each pair of booths.
 for(const [wallIndex,e] of walls.entries()){
  const rotation=(e.angle+90+360)%360,kind=(wallIndex+wallPhase)%3===1?'two':'four',start=1.35+Math.floor(random()*3)*.25;
  const placeRun=(type:'two'|'four')=>{const pitch=type==='four'?2.22:2.35,offset=CATALOG[type].w/2+.12;
   for(let n=0,t=start;t<e.length-1.35;n++,t+=pitch+(type==='four'&&n%2===1?.95:0))seat(type,e.a.x+e.tx*t+e.nx*offset,e.a.z+e.tz*t+e.nz*offset,rotation,1);
  };
  const before=items.length;placeRun(kind);
  // Narrow wings may fit a small-table run while a booth row clips the major aisle.
  if(items.length===before&&kind==='four')placeRun('two');
 }
 // Furnished islands form short internal walls. Their exposed sides remain guest aisles.
 // Try complete modules atomically, so a failed row cannot leave a stray partition behind.
 type ZoneKind='four'|'two';
 function island(x:number,z:number,rotation:number,left:ZoneKind|null,right:ZoneKind|null,corner:boolean){
  const count=(left?2:0)+(right?2:0);
  if(diningCost(items)+count>cap)return false;
  const rad=rotation*Math.PI/180,c=Math.cos(rad),sn=Math.sin(rad),zone:Item[]=[],aisles:ReturnType<typeof bounds>[]=[];
  const local=(kind:Kind,u:number,v:number,turn=0):Item=>({id:`island-${serial}-${zone.length}`,kind,x:x+c*u-sn*v,z:z+sn*u+c*v,rotation:(rotation+turn)%360});
  for(const v of[-1.8,0,1.8])zone.push(local('partition',0,v,90));
  for(const [kind,side] of[[left,-1],[right,1]] as const){if(!kind)continue;
   const offset=CATALOG[kind].w/2+.08,pitch=kind==='four'?2.22:2.3;
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
  const next=[...items,...zone],nav=planningNavigator(next,outline,spawnPoint(outline,next));
  if(!next.filter(i=>i.kind==='two'||i.kind==='four').every(i=>customerSeatAccess(i,nav))||!smallTableGroups(next).every(g=>smallGroupAccess(g,nav)))return false;
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
 for(const [left,right] of palettes){for(const p of zoneCandidates){if(islands>=Math.max(2,Math.ceil(area(outline)/50)))break;
  if(island(p.x,p.z,p.rotation,left,right,corner)){islands++;}
 }}
 // Fill residual dining pockets with an aligned pair of two-person tables.
 // Commit the entire pair or nothing; keep the planned aisles and chair approaches.
 for(const p of zoneCandidates){
  if(diningCost(items)+2>cap)break;
  if(Math.min(...items.filter(i=>['two','four'].includes(i.kind)).map(i=>Math.hypot(i.x-p.x,i.z-p.z)))<2.2)continue;
  const a=p.rotation*Math.PI/180,dx=-Math.sin(a)*1.15,dz=Math.cos(a)*1.15;
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
 const supplyNav=planningNavigator(items,outline,spawnPoint(outline,items));
 for(const {x,z,rotation} of supplyCandidates.sort((a,b)=>a.score-b.score)){
  const i:Item={id:'supply',kind:'serviceTable',x,z,rotation},a=rotation*Math.PI/180;
  const front={x:x-Math.sin(a)*.85,z:z+Math.cos(a)*.85,w:1,d:1.05,rotation};
  if(Math.hypot(x-entry.x,z-entry.z)<3||reserved.some(r=>intersects(bounds(i),r))||guestAisles.some(r=>intersects(bounds(i),r))||!rectInRoom(front,outline,.1)||items.some(o=>intersects(front,bounds(o)))||!supplyNav.reachable(front,.3))continue;
  if(placementError(i,items,outline))continue;
  const next=[...items,i],check=planningNavigator(next,outline,spawnPoint(outline,next));
  if(!next.filter(t=>['two','four'].includes(t.kind)).every(t=>customerSeatAccess(t,check))||!smallTableGroups(next).every(g=>smallGroupAccess(g,check)))continue;
  add('serviceTable',x,z,rotation);guestAisles.push(front);break;
 }
 const spawn=spawnPoint(outline,items);
 // Recheck both bench/chair approaches from the entrance, not just a point near the table.
 const access=planningNavigator(items,outline,spawn);
 for(let n=items.length-1;n>=0;n--){const i=items[n];if(!['four','two'].includes(i.kind))continue;
  if(!customerSeatAccess(i,access))items.splice(n,1);
 }
 // Screens only mark the END of a seating run, never its access side.
 let screens=items.filter(i=>i.kind==='partition').length;for(const i of items.filter(i=>i.kind==='four')){if(screens>=Math.min(22,Math.max(10,Math.ceil(area(outline)/9))))break;const a=i.rotation*Math.PI/180;
  for(const sign of[-1,1]){const candidate:Item={id:`random-${serial++}`,kind:'partition',x:i.x-Math.sin(a)*1.25*sign,z:i.z+Math.cos(a)*1.25*sign,rotation:i.rotation};
   if(guestAisles.some(r=>intersects(bounds(candidate),r))||reserved.some(r=>intersects(bounds(candidate),r))||placementError(candidate,items,outline))continue;
   const next=[...items,candidate],check=planningNavigator(next,outline,spawn);
   if(next.filter(t=>t.kind==='two'||t.kind==='four').every(t=>customerSeatAccess(t,check))&&smallTableGroups(next).every(g=>smallGroupAccess(g,check))){items.push(candidate);screens++;break;}
  }
 }
 // Upgrade structural seating boundaries to permanent plaster walls with handrails.
 // Keep any thin board whose extra depth would obstruct furniture or a guest approach.
 for(let n=0;n<items.length;n++){
  const old=items[n];if(old.kind!=='partition'||!['column-wall-','island-','banquette-wall-'].some(prefix=>old.id.startsWith(prefix)))continue;
  const fixed:Item={...old,kind:'dividerWall'};
  if(placementError(fixed,items.filter((_,j)=>j!==n),outline))continue;
  const next=items.map((i,j)=>j===n?fixed:i),check=planningNavigator(next,outline,spawn);
  if(!next.filter(i=>i.kind==='two'||i.kind==='four').every(i=>customerSeatAccess(i,check))||!smallTableGroups(next).every(g=>smallGroupAccess(g,check)))continue;
  items[n]=fixed;
 }
 // Choose robot starts after the final screens, from the entrance-connected component.
 const nav=planningNavigator(items,outline,spawn);
 for(let z=maxZ-2;z>minZ+1&&items.filter(i=>i.kind==='robot').length<3;z-=1)for(let x=minX+1;x<maxX-1;x+=1){if(items.filter(i=>i.kind==='robot').length>=3)break;if(nav.route(spawn,{x,z}).length)add('robot',x,z);}
 // Door locations ignore artwork, so adding paintings cannot relocate an opening.
 const portals=planningNavigator(items,outline,items.find(i=>i.kind==='robot')??spawn);
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
 const a=item.rotation*Math.PI/180,side=CATALOG[item.kind].w/2+.4;
 return [-1,1].some(sign=>[-.72,0,.72].every(z=>nav.reachable({x:item.x+Math.cos(a)*side*sign-Math.sin(a)*z,z:item.z+Math.sin(a)*side*sign+Math.cos(a)*z},.22)));
}
