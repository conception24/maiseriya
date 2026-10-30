import {planDining} from './dining-planner';
import {CATALOG,isArt,bounds,placementError,spawnPoint,snapArt,edges,entrance,type Layout,type Item,type Point,type Kind} from './floor-plan';
import {intersects} from './geometry';
import {checkoutStaffArea} from './seating-rules';
import {createNavigator} from './robot-navigation';
import {checkoutNeedsScreen,waitingStools,chooseRestroomScreen} from './service-layout';
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
export function randomArrangement(layout:Layout,random=Math.random):Layout{
 const outline=layout.outline,items:Item[]=[],entry=entrance(outline),xs=outline.map(p=>p.x),zs=outline.map(p=>p.z),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);let serial=0;let reserved:ReturnType<typeof bounds>[]=[];
 const add=(kind:Kind,x:number,z:number,rotation=0)=>{const i={id:`random-${serial++}`,kind,x,z,rotation};if(kind==='drinkbar'){const a=rotation*Math.PI/180,front={x:x-Math.sin(a)*.9,z:z+Math.cos(a)*.9,w:3.2,d:1.1,rotation};if(reserved.some(r=>intersects(bounds(i),{...r,w:r.w+.8,d:r.d+.4})||intersects(front,r)))return false;}if(!placementError(i,items,outline)){items.push(i);return true;}return false;};
 // Compare the actual reachable wall-side checkout position, not wall midpoints:
 // a concave inner wall must not beat a side wall close to the entrance.
 const checkoutDistance=(e:ReturnType<typeof edges>[number])=>{
  const t=Math.max(1.5,Math.min(e.length-1.5,(entry.x-e.a.x)*e.tx+(entry.z-e.a.z)*e.tz));
  return Math.hypot(e.a.x+e.tx*t+e.nx*1.05-entry.x,e.a.z+e.tz*t+e.nz*1.05-entry.z);
 };
 checkout:for(const e of edges(outline).filter(e=>e.i!==entry.i&&Math.abs(e.angle%90)<.01&&e.length>3).sort((a,b)=>checkoutDistance(a)-checkoutDistance(b))){
 const t=Math.max(1.5,Math.min(e.length-1.5,(entry.x-e.a.x)*e.tx+(entry.z-e.a.z)*e.tz));
 if(add('checkout',e.a.x+e.tx*t+e.nx*1.05,e.a.z+e.tz*t+e.nz*1.05,(e.angle+360)%360))break checkout;
 }
 const initialDoors=planningNavigator(items,outline,spawnPoint(outline,items));reserved=[...initialDoors.kitchens,...(initialDoors.restroom?[initialDoors.restroom]:[])].map(k=>({x:k.door.x+k.nx*.9,z:k.door.z+k.nz*.9,w:k.width+1.1,d:2.8,rotation:edges(outline)[k.edge].angle}));
 reserved.push(...items.filter(i=>i.kind==='checkout').map(checkoutStaffArea));
 const checkout=items.find(i=>i.kind==='checkout');
 if(checkout&&checkoutNeedsScreen(checkout,items,outline)){const a=checkout.rotation*Math.PI/180,c=Math.cos(a),sn=Math.sin(a),side=(entry.x-checkout.x)*c+(entry.z-checkout.z)*sn>0?1:-1;
  for(const sign of[side,-side]){const panel:Item={id:'checkout-screen',kind:'partition',x:checkout.x+c*.82*sign-sn*.08,z:checkout.z+sn*.82*sign+c*.08,rotation:(checkout.rotation+90)%360};if(!reserved.some(r=>intersects(bounds(panel),r))&&!placementError(panel,items,outline)){items.push(panel);serial++;break;}}
 }
 // A sight screen faces the WC opening; guests can enter around either end.
 const wc=initialDoors.restroom;
 // A compact staff-only hand basin on the wall beside the primary kitchen.
 // Keep the kitchen portal and the entrance-connected path open.
 const k=initialDoors.kitchens[0];
 if(k){const wall=edges(outline)[k.edge];if(Math.abs(wall.angle%90)<.01){
  sink:for(const offset of[k.width/2+.38,k.width/2+.7,k.width/2+1.05, k.width/2+1.4])for(const sign of[1,-1]){
   const x=k.door.x+wall.tx*offset*sign+wall.nx*.32,z=k.door.z+wall.tz*offset*sign+wall.nz*.32;
   const sink:Item={id:'staff-sink',kind:'staffSink',x,z,rotation:(wall.angle+360)%360};
   const useArea={x:x+wall.nx*.65,z:z+wall.nz*.65,w:.7,d:.85,rotation:wall.angle};
   if(placementError(sink,items,outline)||items.filter(i=>i.kind==='checkout').some(i=>intersects(useArea,bounds(i))))continue;
   const nav=planningNavigator([...items,sink],outline,spawnPoint(outline,[...items,sink]));
   if(![...initialDoors.kitchens,...(initialDoors.restroom?[initialDoors.restroom]:[])].every(p=>nav.reachable(p.point,.35)))continue;
   items.push(sink);reserved.push(useArea);break sink;
  }
 }}
 // A wall-side refreshment counter, with its serving side facing the room.
 bar:for(const e of edges(outline).filter(e=>Math.abs(e.angle%90)<.01&&e.i!==entry.i).sort((a,b)=>b.length-a.length))for(let t=1.5;t<e.length-1.4;t+=1.5){if(add('drinkbar',e.a.x+e.tx*t+e.nx*.55,e.a.z+e.tz*t+e.nz*.55,(e.angle+360)%360))break bar;}
 const doorPortals=[...initialDoors.kitchens,...(initialDoors.restroom?[initialDoors.restroom]:[])];
 if(checkout){const a=checkout.rotation*Math.PI/180,c=Math.cos(a),sn=Math.sin(a);stand:for(const side of[-1,1])for(const v of[.6,1,1.4]){const stand:Item={id:'waiting-stand',kind:'waitingStand',x:checkout.x+c*side*1.05-sn*v,z:checkout.z+sn*side*1.05+c*v,rotation:checkout.rotation};if(placementError(stand,items,outline)||reserved.some(r=>intersects(bounds(stand),r)))continue;const nav=planningNavigator([...items,stand],outline,spawnPoint(outline,[...items,stand]));if(!doorPortals.every(p=>nav.reachable(p.point,.35)))continue;items.push(stand);break stand;}}

 items.push(...waitingStools(items,outline,doorPortals,reserved,random));
 const dining=planDining(outline,items,reserved,random);
 items.splice(0,items.length,...dining.items);
 if(wc){const screen=chooseRestroomScreen(items,outline,wc,doorPortals,reserved),old=items.findIndex(i=>i.id==='wc-screen');if(old>=0)items.splice(old,1);if(screen)items.push(screen);}
 items.push(...waitingStools(items,outline,doorPortals,reserved,random));
 const spawn=spawnPoint(outline,items);
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
 for(const e of edges(outline))for(let t=1.7;t<e.length-1.5;t+=4.5){
  // Artwork replaces the affected window bays with wall panels in 3D; keep
  // the windows behind a continuous bench unobstructed.
  const windowWall=(e.nx<-.8||e.nz>.8)&&e.length>3&&e.i!==entry.i&&!openings.some(k=>k.edge===e.i);
  if(windowWall){const bay=e.length/Math.ceil(e.length/2.5),artWidth=Math.max(...artworks.map(kind=>CATALOG[kind].w));
   const blocked=items.some(b=>{if(b.kind!=='bench'||Math.abs(((b.rotation-e.angle+360)%360)-180)>1||Math.abs((b.x-e.a.x)*e.nx+(b.z-e.a.z)*e.nz-.42)>.10)return false;
    const bt=(b.x-e.a.x)*e.tx+(b.z-e.a.z)*e.tz;
    for(let center=bay/2;center<e.length;center+=bay)if(Math.abs(t-center)<(bay+artWidth)/2+.1&&Math.abs(bt-center)<(bay+CATALOG.bench.w)/2)return true;
    return false;});if(blocked)continue;
  }
  const art=snapArt({id:`random-${serial++}`,kind:artworks[Math.floor(random()*artworks.length)],x:e.a.x+t*e.tx,z:e.a.z+t*e.tz,rotation:0},outline);if(openings.some(k=>intersects(bounds(art),{x:k.door.x,z:k.door.z,w:k.width+.9,d:.8,rotation:edges(outline)[k.edge].angle})))continue;if(!behindBar(art)&&!placementError(art,items,outline))candidates.push(art);}
 const limit=Math.min(8,Math.max(3,Math.round(outline.reduce((sum,p,n)=>sum+Math.hypot(p.x-outline[(n+1)%outline.length].x,p.z-outline[(n+1)%outline.length].z),0)/14)));
 while(candidates.length&&items.filter(i=>isArt(i.kind)).length<limit){const art=candidates.splice(Math.floor(random()*candidates.length),1)[0];if(!placementError(art,items,outline))items.push(art);}
 return {...layout,items};
}

export {customerSeatAccess} from './seating-rules';
