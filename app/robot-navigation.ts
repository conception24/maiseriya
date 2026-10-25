import {isArt,canWalk,colliders,edges,entrance,type Item,type Point} from './floor-plan';
// A quarter-metre grid with swept collision checks: no cutting through table corners.
export function createNavigator(items:Item[],outline:Point[],home:Point){
 const obs=colliders(items),step=.25,minX=Math.ceil(Math.min(...outline.map(p=>p.x))/step),maxX=Math.floor(Math.max(...outline.map(p=>p.x))/step),minZ=Math.ceil(Math.min(...outline.map(p=>p.z))/step),maxZ=Math.floor(Math.max(...outline.map(p=>p.z))/step),width=maxX-minX+1;
 const valid=new Map<number,Point>();
 for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){if(canWalk(x*step,z*step,obs,outline,.3))valid.set((z-minZ)*width+x-minX,{x:x*step,z:z*step});}
 const id=(p:Point)=>(Math.round(p.z/step)-minZ)*width+Math.round(p.x/step)-minX;
 const swept=(a:Point,b:Point)=>[.25,.5,.75,1].every(t=>canWalk(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,obs,outline,.3));
 // Static furniture collision checks are cached once, rather than repeated for every BFS.
 const links=new Map<number,number[]>();for(const [key,p] of valid)links.set(key,[key-1,key+1,key-width,key+width].filter(n=>{const q=valid.get(n);return q&&Math.hypot(p.x-q.x,p.z-q.z)<.26&&swept(p,q);}));
 function search(start:Point,blocked:Point[]=[]){const safeAnchor=(p:Point)=>swept(start,p)&&blocked.every(o=>[.25,.5,.75,1].every(t=>Math.hypot(start.x+(p.x-start.x)*t-o.x,start.z+(p.z-start.z)*t-o.z)>=Math.min(.60,Math.hypot(start.x-o.x,start.z-o.z)-.00001)));let first=id(start);if(valid.has(first)&&!safeAnchor(valid.get(first)!)){const near=[...valid].filter(([,p])=>Math.hypot(p.x-start.x,p.z-start.z)<.55&&safeAnchor(p)).sort((a,b)=>Math.hypot(a[1].x-start.x,a[1].z-start.z)-Math.hypot(b[1].x-start.x,b[1].z-start.z))[0];first=near?.[0]??-1;}if(!valid.has(first))return{parents:new Map<number,number>(),first};const parents=new Map([[first,-1]]),queue=[first];for(let k=0;k<queue.length;k++){const cur=queue[k],p=valid.get(cur)!;for(const next of links.get(cur)??[]){const q=valid.get(next)!;if(!parents.has(next)&&blocked.every(o=>[.25,.5,.75,1].every(t=>Math.hypot(p.x+(q.x-p.x)*t-o.x,p.z+(q.z-p.z)*t-o.z)>=Math.min(.60,Math.hypot(p.x-o.x,p.z-o.z)-.00001)))){parents.set(next,cur);queue.push(next);}}}return{parents,first};}
 const component=search(home).parents,available=[...component.keys()].map(n=>valid.get(n)!);
 const goals:Point[]=[],services:{tableId:string;point:Point}[]=[];
 for(const item of items.filter(i=>['two','four','table','wideTable'].includes(i.kind))){const near=available.filter(p=>Math.hypot(p.x-item.x,p.z-item.z)<2).sort((a,b)=>Math.hypot(a.x-item.x,a.z-item.z)-Math.hypot(b.x-item.x,b.z-item.z))[0];if(near){services.push({tableId:item.id,point:near});if(Math.hypot(near.x-home.x,near.z-home.z)>.8&&!goals.some(g=>Math.hypot(g.x-near.x,g.z-near.z)<.8))goals.push(near);}}
 if(!goals.length){const far=available.sort((a,b)=>Math.hypot(b.x-home.x,b.z-home.z)-Math.hypot(a.x-home.x,a.z-home.z))[0];if(far&&Math.hypot(far.x-home.x,far.z-home.z)>1)goals.push(far);}
 goals.push(home);
 const entry=entrance(outline),candidates:{edge:number;point:Point;door:Point;outside:Point;nx:number;nz:number;score:number;width:number;depth:number}[]=[];
 // Openings are architectural: seats and pictures must never move them.
 const fixtures=colliders(items.filter(i=>i.kind==='checkout'));
 for(const e of edges(outline)){if(e.i===entry.i||e.length<1.5)continue;for(let t=.75;t<=e.length-.75;t+=.25){const door={x:e.a.x+t*e.tx,z:e.a.z+t*e.tz},p={x:door.x+e.nx*.75,z:door.z+e.nz*.75};if(!canWalk(p.x,p.z,fixtures,outline,.3)||items.some(i=>i.kind==='checkout'&&Math.hypot(i.x-door.x,i.z-door.z)<1.1))continue;candidates.push({edge:e.i,point:p,door,width:1.1+(e.i%3)*.12,depth:1.2+(e.i%3)*.4,outside:{x:door.x-e.nx*.85,z:door.z-e.nz*.85},nx:e.nx,nz:e.nz,score:Math.hypot(door.x-entry.x,door.z-entry.z)});}}

 const checkout=items.find(i=>i.kind==='checkout');candidates.sort((a,b)=>checkout?Math.hypot(a.door.x-checkout.x,a.door.z-checkout.z)-Math.hypot(b.door.x-checkout.x,b.door.z-checkout.z):b.score-a.score);
 const kitchens:typeof candidates=[];for(const c of candidates){if(kitchens.some(k=>k.edge===c.edge||Math.hypot(k.door.x-c.door.x,k.door.z-c.door.z)<5))continue;kitchens.push(c);if(kitchens.length>=(outline.length>4?2:1))break;}
 const kitchen=kitchens[0]??null;
 const restroom=candidates.find(c=>!kitchens.some(k=>k.edge===c.edge||Math.hypot(k.door.x-c.door.x,k.door.z-c.door.z)<4))??null;
 function trace(start:Point,last:number,parents:Map<number,number>,first:number){if(!parents.has(last))return[];const route:Point[]=[];let n=last;while(n!==first){route.push(valid.get(n)!);n=parents.get(n)!;}const anchor=valid.get(first)!;if(!swept(start,anchor))return[];if(Math.hypot(anchor.x-start.x,anchor.z-start.z)>.001)route.push(anchor);return route.reverse();}
 // Round grid corners into sampled quadratic arcs; validate the entire swept disc.
 // Keep the original corner when an aisle is too tight for a safe curve.
 function smooth(start:Point,path:Point[],blocked:Point[]){
  if(!path.length)return path;
  const points=[start,...path],turns:Point[]=[start];
  for(let n=1;n<points.length-1;n++){const a=points[n-1],b=points[n],c=points[n+1];if(Math.abs((b.x-a.x)*(c.z-b.z)-(b.z-a.z)*(c.x-b.x))>.000001)turns.push(b);}
  turns.push(points[points.length-1]);const result:Point[]=[];let cursor=start;
  const line=(to:Point)=>{const from=cursor,count=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.06));for(let n=1;n<=count;n++)result.push({x:from.x+(to.x-from.x)*n/count,z:from.z+(to.z-from.z)*n/count});cursor=to;};
  for(let n=1;n<turns.length-1;n++){
   const a=turns[n-1],b=turns[n],c=turns[n+1],ab=Math.hypot(b.x-a.x,b.z-a.z),bc=Math.hypot(c.x-b.x,c.z-b.z),trim=Math.min(.5,ab*.45,bc*.45);
   const entry={x:b.x+(a.x-b.x)*trim/ab,z:b.z+(a.z-b.z)*trim/ab},exit={x:b.x+(c.x-b.x)*trim/bc,z:b.z+(c.z-b.z)*trim/bc};
   const arc:Point[]=[];for(let k=0;k<=24;k++){const t=k/24,u=1-t;arc.push({x:u*u*entry.x+2*u*t*b.x+t*t*exit.x,z:u*u*entry.z+2*u*t*b.z+t*t*exit.z});}
   if(arc.every((p,n)=>canWalk(p.x,p.z,obs,outline,.3)&&(n===0||swept(arc[n-1],p))&&blocked.every(o=>Math.hypot(p.x-o.x,p.z-o.z)>=.60))){line(entry);for(const p of arc.slice(1))line(p);}else line(b);
  }
  line(turns[turns.length-1]);return result;
 }
 return{goals,services,kitchen,kitchens,restroom,reachable:(p:Point,tolerance=.22)=>available.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<=tolerance),route(start:Point,target:Point,blocked:Point[]=[]){const{parents,first}=search(start,blocked);return smooth(start,trace(start,id(target),parents,first),blocked);},yieldRoute(start:Point,blocked:Point[],avoid:Point[]){const{parents,first}=search(start,blocked);const target=[...parents.keys()].map(key=>({key,p:valid.get(key)!})).filter(({p})=>Math.hypot(p.x-start.x,p.z-start.z)>.8&&blocked.every(o=>Math.hypot(p.x-o.x,p.z-o.z)>1)&&avoid.every(o=>Math.hypot(p.x-o.x,p.z-o.z)>.85)).sort((a,b)=>Math.hypot(a.p.x-start.x,a.p.z-start.z)-Math.hypot(b.p.x-start.x,b.p.z-start.z))[0];return target?smooth(start,trace(start,target.key,parents,first),blocked):[];},canMove:(p:Point)=>canWalk(p.x,p.z,obs,outline,.3)};
}
