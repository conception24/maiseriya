import {CATALOG,bounds,edges,isArt,spawnPoint,type Layout} from './floor-plan';
import {area,rectInRoom} from './geometry';
import {createNavigator} from './robot-navigation';
import {customerSeatAccess,randomArrangement} from './random-layout';
export type Preferences={density:number;order:number;coverage:number;wall:number};
export const defaultPreferences:Preferences={density:1,order:1,coverage:1,wall:1};
export type Assessment={seats:number;tables:number;blocked:number;density:number;order:number;coverage:number;wall:number;score:number};
export type Proposal={layout:Layout;assessment:Assessment};
export type Feedback={choice:'A'|'B'|'neither';reason:string;note:string;at:string;a:Proposal;b:Proposal};
export function assess(layout:Layout,weights:Preferences=defaultPreferences):Assessment{
 const tables=layout.items.filter(i=>i.kind==='two'||i.kind==='four'),walls=edges(layout.outline),nav=createNavigator(layout.items,layout.outline,spawnPoint(layout.outline,layout.items));
 const blocked=tables.filter(i=>!customerSeatAccess(i,nav)).length+layout.items.filter(i=>['serviceTable','drinkbar','checkout'].includes(i.kind)&&!nav.reachable({x:i.x-Math.sin(i.rotation*Math.PI/180)*.85,z:i.z+Math.cos(i.rotation*Math.PI/180)*.85},.3)).length;
 const density=Math.min(1,tables.length/Math.max(1,area(layout.outline)/10.5));
 const order=tables.filter(i=>tables.some(j=>j!==i&&i.rotation%180===j.rotation%180&&(Math.abs(i.x-j.x)<.12||Math.abs(i.z-j.z)<.12))).length/Math.max(1,tables.length);
 const wall=tables.filter(i=>walls.some(e=>{const t=(i.x-e.a.x)*e.tx+(i.z-e.a.z)*e.tz;return t>=0&&t<=e.length&&Math.abs((i.x-e.a.x)*e.nx+(i.z-e.a.z)*e.nz)<CATALOG[i.kind].w/2+.35;})||layout.items.some(p=>p.kind==='partition'&&Math.hypot(i.x-p.x,i.z-p.z)<2)).length/Math.max(1,tables.length);
 let samples=0,unused=0;const xs=layout.outline.map(p=>p.x),zs=layout.outline.map(p=>p.z);
 for(let x=Math.min(...xs)+1;x<Math.max(...xs);x+=1)for(let z=Math.min(...zs)+1;z<Math.max(...zs);z+=1){
  if(!rectInRoom({x,z,w:1,d:1,rotation:0},layout.outline,.1))continue;samples++;
  const distance=Math.min(...layout.items.filter(i=>!isArt(i.kind)&&i.kind!=='robot').map(i=>{const a=i.rotation*Math.PI/180,dx=x-i.x,dz=z-i.z,r=bounds(i);return Math.hypot(Math.max(0,Math.abs(dx*Math.cos(a)+dz*Math.sin(a))-r.w/2),Math.max(0,Math.abs(-dx*Math.sin(a)+dz*Math.cos(a))-r.d/2));}));
  if(distance>1.8)unused++;
 }
 const coverage=1-unused/Math.max(1,samples),score=(density*weights.density+order*weights.order+coverage*weights.coverage+wall*weights.wall)*25-Math.abs(density-.8)*40-blocked*1000;
 return{tables:tables.length,seats:tables.reduce((n,i)=>n+CATALOG[i.kind].seats,0),blocked,density,order,coverage,wall,score};
}
export function proposals(layout:Layout,weights:Preferences=defaultPreferences,random=Math.random):Proposal[]{
 const candidates=Array.from({length:4},()=>{const next=randomArrangement(layout,random);return{layout:next,assessment:assess(next,weights)};});
 return candidates.filter(p=>p.assessment.blocked===0&&p.assessment.tables>0).sort((a,b)=>b.assessment.score-a.assessment.score);
}
// Bounded preference updates never weaken collision or guest-access constraints.
export function learn(weights:Preferences,feedback:Feedback):Preferences{
 if(feedback.choice==='neither')return weights;
 const winner=feedback.choice==='A'?feedback.a:feedback.b,loser=feedback.choice==='A'?feedback.b:feedback.a,next={...weights};
 for(const key of Object.keys(next) as (keyof Preferences)[])next[key]=Math.max(.35,Math.min(2.5,next[key]+.4*(winner.assessment[key]-loser.assessment[key])));
 return next;
}
