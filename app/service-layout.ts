import {bounds,colliders,edges,entrance,placementError,spawnPoint,CATALOG,type Item,type Point,type Rect} from './floor-plan';
import {createCircleChecker,intersects} from './geometry';
import {createNavigator} from './robot-navigation';
import {chairClearance} from './layout-quality';
import {customerSeatAccess,smallGroupAccess,smallTableGroups} from './seating-rules';
type Portal={door:Point;point:Point;edge:number;nx:number;nz:number;width:number};

// A screen is useful when a guest can reach a person-sized space behind the counter.
export function checkoutNeedsScreen(checkout:Item,items:Item[],outline:Point[]){
 const walk=createCircleChecker([...colliders(items.filter(i=>i.id!==checkout.id)),bounds(checkout)],outline,.3);
 const a=checkout.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),targets:Point[]=[];
 for(const u of[-.5,0,.5])for(const v of[-.7,-.8,-.9,-1.05]){const p={x:checkout.x+c*u-s*v,z:checkout.z+s*u+c*v};if(walk(p.x,p.z))targets.push(p);}
 if(!targets.length)return false;
 const step=.25,front={x:checkout.x-s*.95,z:checkout.z+c*.95},xs=outline.map(p=>p.x),zs=outline.map(p=>p.z),minX=Math.ceil(Math.min(...xs)/step),maxX=Math.floor(Math.max(...xs)/step),minZ=Math.ceil(Math.min(...zs)/step),maxZ=Math.floor(Math.max(...zs)/step);
 const starts:{x:number;z:number}[]=[];for(let x=Math.floor(front.x/step)-2;x<=Math.ceil(front.x/step)+2;x++)for(let z=Math.floor(front.z/step)-2;z<=Math.ceil(front.z/step)+2;z++)if(Math.hypot(x*step-front.x,z*step-front.z)<.4&&walk(x*step,z*step))starts.push({x,z});
 const queue=starts,seen=new Set(starts.map(p=>`${p.x},${p.z}`));
 for(let k=0;k<queue.length;k++){const p=queue[k],x=p.x*step,z=p.z*step;if(targets.some(t=>Math.hypot(t.x-x,t.z-z)<.22))return true;
  for(const [dx,dz] of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=p.x+dx,nz=p.z+dz,key=`${nx},${nz}`;if(nx<minX||nx>maxX||nz<minZ||nz>maxZ||seen.has(key)||!walk(nx*step,nz*step))continue;if(!walk((x+nx*step)/2,(z+nz*step)/2))continue;seen.add(key);queue.push({x:nx,z:nz});}
 }
 return false;
}

export function waitingStools(items:Item[],outline:Point[],portals:Portal[],reserved:Rect[],random:()=>number=()=>.5):Item[]{
 const checkout=items.find(i=>i.kind==='checkout');if(!checkout)return [];
 const e=entrance(outline),a=checkout.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 const entranceZone={x:e.x+e.nx*1.65,z:e.z+e.nz*1.65,w:e.width,d:3.3,rotation:e.angle};
 const front={x:checkout.x-s*.95,z:checkout.z+c*.95};
 // Each row is anchored to a wall, partition, or the back of a bench.
 const supports:{x:number;z:number;tx:number;tz:number;nx:number;nz:number;length:number;angle:number}[]=[];
 for(const wall of edges(outline))if(Math.abs(wall.angle%90)<.01&&wall.length>1.5)supports.push({x:wall.a.x,z:wall.a.z,tx:wall.tx,tz:wall.tz,nx:wall.nx,nz:wall.nz,length:wall.length,angle:wall.angle});
 for(const item of items.filter(i=>i.id!=='wc-screen'&&['partition','dividerWall','bench'].includes(i.kind))){const a=item.rotation*Math.PI/180,tx=Math.cos(a),tz=Math.sin(a),length=CATALOG[item.kind].w,half=CATALOG[item.kind].d/2;
  for(const side of(item.kind==='bench'?[1]:[-1,1])){const nx=-Math.sin(a)*side,nz=Math.cos(a)*side;supports.push({x:item.x-tx*length/2+nx*half,z:item.z-tz*length/2+nz*half,tx,tz,nx,nz,length,angle:item.rotation});}}
 const candidates:{stools:Item[];distance:number}[]=[];
 for(const support of supports)for(let start=.25;start<=support.length-1.37;start+=.28){const stools:Item[]=[0,.56,1.12].map((offset,n)=>({id:`waiting-stool-${n+1}`,kind:'stool',x:support.x+support.tx*(start+offset)+support.nx*.31,z:support.z+support.tz*(start+offset)+support.nz*.31,rotation:Math.round(support.angle/90)*90%360}));
  const distance=Math.hypot(stools[1].x-checkout.x,stools[1].z-checkout.z);if(distance>4.4)continue;
  if(stools.some((i,n)=>placementError(i,[...items,...stools.slice(0,n)],outline)||[...reserved,entranceZone].some(r=>intersects(bounds(i),r))||Math.hypot(i.x-front.x,i.z-front.z)<.8))continue;
  candidates.push({stools,distance:distance+random()*.15});
 }
 candidates.sort((a,b)=>a.distance-b.distance);
 for(const {stools} of candidates){const all=[...items,...stools],nav=createNavigator(all,outline,spawnPoint(outline,all),{services:false});
  if(!portals.every(p=>nav.reachable(p.point,.35))||!nav.reachable(front,.35))continue;
  if(!stools.every(i=>[[-.55,0],[.55,0],[0,.55],[0,-.55]].some(([dx,dz])=>nav.reachable({x:i.x+dx,z:i.z+dz},.3))))continue;
  return stools;
 }
 return [];
}

export function screenBlocksView(screen:Item,from:Point,to:Point){
 const a=screen.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 const ax=(from.x-screen.x)*c+(from.z-screen.z)*s,az=-(from.x-screen.x)*s+(from.z-screen.z)*c;
 const bx=(to.x-screen.x)*c+(to.z-screen.z)*s,bz=-(to.x-screen.x)*s+(to.z-screen.z)*c;
 if(az*bz>=0||Math.abs(bz-az)<1e-8)return false;
 const t=-az/(bz-az);return Math.abs(ax+(bx-ax)*t)<=.88;
}

// Choose a screen by how many actual seating viewpoints lose sight of the WC.
export function chooseRestroomScreen(items:Item[],outline:Point[],wc:Portal,portals:Portal[],reserved:Rect[]):Item|null{
 const current=items.find(i=>i.id==='wc-screen'),base=items.filter(i=>i.id!=='wc-screen'),wall=edges(outline)[wc.edge];
 const seats:Point[]=[];for(const i of base){const a=i.rotation*Math.PI/180,s=Math.sin(a),c=Math.cos(a);
  if(i.kind==='chair'||i.kind==='bench')seats.push(i);
  if(i.kind==='four'||i.kind==='two')for(const v of[-.78,.78])seats.push({x:i.x-s*v,z:i.z+c*v});
 }
 const candidates:Item[]=[];if(current)candidates.push(current);
 for(const d of[2.5,2.8,3.1,3.4])for(const shift of[0,-.45,.45,-.9,.9])for(const turn of[0,90])candidates.push({id:'wc-screen',kind:'partition',x:wc.door.x+wc.nx*d+wall.tx*shift,z:wc.door.z+wc.nz*d+wall.tz*shift,rotation:(Math.round(wall.angle/90)*90+turn+360)%360});
 const targets=[-.28,0,.28].map(t=>({x:wc.door.x+wall.tx*wc.width*t,z:wc.door.z+wall.tz*wc.width*t}));
 const score=(i:Item)=>seats.reduce((n,p)=>n+targets.filter(t=>screenBlocksView(i,p,t)).length,0);
 candidates.sort((x,y)=>score(y)-score(x));
 for(const screen of candidates){if(placementError(screen,base,outline)||reserved.some(r=>intersects(bounds(screen),r)))continue;
  const next=[...base,screen];if(chairClearance({items:next,outline,chairStyle:'gray'})<.999)continue;
  const nav=createNavigator(next,outline,spawnPoint(outline,next),{services:false});
  if(!portals.every(p=>nav.reachable(p.point,.35))||!next.filter(i=>i.kind==='two'||i.kind==='four').every(i=>customerSeatAccess(i,nav))||!smallTableGroups(next).every(group=>smallGroupAccess(group,nav)))continue;
  return screen;
 }
 return current??null;
}

