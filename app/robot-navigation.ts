import {canWalk,colliders,edges,entrance,type Item,type Point} from './floor-plan';
// A quarter-metre grid with swept collision checks: no cutting through table corners.
export function createNavigator(items:Item[],outline:Point[],home:Point){
 const obs=colliders(items),step=.25,minX=Math.ceil(Math.min(...outline.map(p=>p.x))/step),maxX=Math.floor(Math.max(...outline.map(p=>p.x))/step),minZ=Math.ceil(Math.min(...outline.map(p=>p.z))/step),maxZ=Math.floor(Math.max(...outline.map(p=>p.z))/step),width=maxX-minX+1;
 const valid=new Map<number,Point>();
 for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){if(canWalk(x*step,z*step,obs,outline,.3))valid.set((z-minZ)*width+x-minX,{x:x*step,z:z*step});}
 const id=(p:Point)=>(Math.round(p.z/step)-minZ)*width+Math.round(p.x/step)-minX;
 const swept=(a:Point,b:Point)=>[.25,.5,.75,1].every(t=>canWalk(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,obs,outline,.3));
 function search(start:Point,blocked:Point[]=[]){const first=id(start);if(!valid.has(first))return{parents:new Map<number,number>(),first};const parents=new Map([[first,-1]]),queue=[first];for(let k=0;k<queue.length;k++){const cur=queue[k],p=valid.get(cur)!;for(const next of[cur-1,cur+1,cur-width,cur+width]){const q=valid.get(next);if(q&&!parents.has(next)&&Math.hypot(p.x-q.x,p.z-q.z)<.26&&swept(p,q)&&blocked.every(o=>[.25,.5,.75,1].every(t=>Math.hypot(p.x+(q.x-p.x)*t-o.x,p.z+(q.z-p.z)*t-o.z)>=Math.min(.60,Math.hypot(p.x-o.x,p.z-o.z)-.00001)))){parents.set(next,cur);queue.push(next);}}}return{parents,first};}
 const component=search(home).parents,available=[...component.keys()].map(n=>valid.get(n)!);
 const goals:Point[]=[],services:{tableId:string;point:Point}[]=[];
 for(const item of items.filter(i=>['two','four','table','wideTable'].includes(i.kind))){const near=available.filter(p=>Math.hypot(p.x-item.x,p.z-item.z)<2).sort((a,b)=>Math.hypot(a.x-item.x,a.z-item.z)-Math.hypot(b.x-item.x,b.z-item.z))[0];if(near){services.push({tableId:item.id,point:near});if(Math.hypot(near.x-home.x,near.z-home.z)>.8&&!goals.some(g=>Math.hypot(g.x-near.x,g.z-near.z)<.8))goals.push(near);}}
 if(!goals.length){const far=available.sort((a,b)=>Math.hypot(b.x-home.x,b.z-home.z)-Math.hypot(a.x-home.x,a.z-home.z))[0];if(far&&Math.hypot(far.x-home.x,far.z-home.z)>1)goals.push(far);}
 goals.push(home);
 const entry=entrance(outline),candidates:{edge:number;point:Point;door:Point;outside:Point;nx:number;nz:number;score:number}[]=[];
 for(const e of edges(outline)){if(e.i===entry.i||e.length<1.5)continue;for(const p of available){const t=(p.x-e.a.x)*e.tx+(p.z-e.a.z)*e.tz,dist=(p.x-e.a.x)*e.nx+(p.z-e.a.z)*e.nz;if(t<.75||t>e.length-.75||dist<.4||dist>.8)continue;const door={x:e.a.x+t*e.tx,z:e.a.z+t*e.tz};if(items.some(i=>Math.hypot(i.x-door.x,i.z-door.z)<1.1))continue;const approach={x:door.x+e.nx*.4,z:door.z+e.nz*.4};if(!swept(p,approach))continue;candidates.push({edge:e.i,point:p,door,outside:{x:door.x-e.nx*.85,z:door.z-e.nz*.85},nx:e.nx,nz:e.nz,score:Math.hypot(door.x-entry.x,door.z-entry.z)});}}
 const kitchen=candidates.sort((a,b)=>b.score-a.score)[0]??null;
 return{goals,services,kitchen,route(start:Point,target:Point,blocked:Point[]=[]){const{parents,first}=search(start,blocked),last=id(target);if(!parents.has(last))return[];const route:Point[]=[];let n=last;while(n!==first){route.push(valid.get(n)!);n=parents.get(n)!;}const anchor=valid.get(first)!;if(!swept(start,anchor))return[];if(Math.hypot(anchor.x-start.x,anchor.z-start.z)>.001)route.push(anchor);return route.reverse();},canMove:(p:Point)=>canWalk(p.x,p.z,obs,outline,.3)};
}

