import {planDining} from './dining-planner';
import {CATALOG,isArt,bounds,placementError,spawnPoint,snapArt,edges,entrance,type Layout,type Item,type Point,type Kind} from './floor-plan';
import {intersects} from './geometry';
import {checkoutStaffArea} from './seating-rules';
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
 const dining=planDining(outline,items,reserved,random);
 items.splice(0,items.length,...dining.items);
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
 for(const e of edges(outline))for(let t=1.7;t<e.length-1.5;t+=4.5){const art=snapArt({id:`random-${serial++}`,kind:artworks[Math.floor(random()*artworks.length)],x:e.a.x+t*e.tx,z:e.a.z+t*e.tz,rotation:0},outline);if(openings.some(k=>intersects(bounds(art),{x:k.door.x,z:k.door.z,w:k.width+.9,d:.8,rotation:edges(outline)[k.edge].angle})))continue;if(!behindBar(art)&&!placementError(art,items,outline))candidates.push(art);}
 const limit=Math.min(8,Math.max(3,Math.round(outline.reduce((sum,p,n)=>sum+Math.hypot(p.x-outline[(n+1)%outline.length].x,p.z-outline[(n+1)%outline.length].z),0)/14)));
 while(candidates.length&&items.filter(i=>isArt(i.kind)).length<limit){const art=candidates.splice(Math.floor(random()*candidates.length),1)[0];if(!placementError(art,items,outline))items.push(art);}
 return {...layout,items};
}

export {customerSeatAccess} from './seating-rules';
