import {LayoutPlanningError} from './dining-planner';
import {spatialQuality} from './layout-quality';
import {CATALOG,bounds,edges,isArt,spawnPoint,entrance,type Layout} from './floor-plan';
import {area,rectInRoom} from './geometry';
import {createNavigator} from './robot-navigation';
import {diningCost,smallTableGroups,smallGroupAccess} from './seating-rules';
import {customerSeatAccess,randomArrangement} from './random-layout';
export type Preferences={density:number;order:number;coverage:number;wall:number;dividers:number};
export const defaultPreferences:Preferences={density:1,order:1,coverage:1.15,wall:1.2,dividers:1.2};
export type Assessment={seats:number;tables:number;blocked:number;density:number;order:number;coverage:number;wall:number;dividers:number;banquette:number;emptyRadius:number;deadEnds?:number;comfort?:number;structure?:number;circulation?:number;waste?:number;usableEmptyRadius?:number;aisleExcess?:number;score:number};
export type Proposal={layout:Layout;assessment:Assessment};
export const ISSUE_OPTIONS=[
 {id:'aisles-wide',label:'通路が広すぎる'}, {id:'aisles-narrow',label:'通路が狭すぎる'},
 {id:'few-walls',label:'追加壁・仕切りが少ない'}, {id:'many-walls',label:'追加壁・仕切りが多すぎる'},
 {id:'many-tables',label:'テーブルが多すぎる'}, {id:'few-tables',label:'テーブルが少なすぎる'},
 {id:'empty-space',label:'大きな空白・無駄な隙間がある'}, {id:'unaligned',label:'席や壁の並びがそろっていない'},
 {id:'seat-access',label:'席に入りにくい・閉じ込められている'}, {id:'booth-backs',label:'ボックス席の背中合わせが不自然'},
 {id:'wall-seats',label:'壁沿いに置くべき席が中央にある'}, {id:'route-confusing',label:'通路が分かりにくい・行き止まりがある'},
 {id:'entry-seats',label:'入口のすぐ前に席がある'}, {id:'toilet-seats',label:'トイレの前に席がある'},
 {id:'kitchen-route',label:'キッチンの出入り・配膳の道が悪い'}, {id:'checkout',label:'レジの場所が不自然'},
 {id:'drinkbar',label:'ドリンクバーの場所・利用空間が悪い'}, {id:'supply',label:'調味料台の場所・取りやすさが悪い'},
 {id:'seat-mix',label:'二人席・団体席の割合がおかしい'}, {id:'wall-route',label:'追加壁が通路や席のまとまりを作れていない'}
] as const;
export type AnswerId=typeof ISSUE_OPTIONS[number]['id']|'good'|'unsure'|'other';
export type AnswerSelection={id:AnswerId;label:string;addOption?:boolean};
export type Feedback={answers:AnswerSelection[];note:string;at:string;proposal:Proposal};
export function toggleAnswer(selected:AnswerSelection[],answer:AnswerSelection):AnswerSelection[]{
 const same=(a:AnswerSelection)=>a.id===answer.id&&a.label===answer.label;
 if(selected.some(same))return selected.filter(a=>!same(a));
 if(answer.id==='good'||answer.id==='unsure')return[answer];
 return[...selected.filter(a=>a.id!=='good'&&a.id!=='unsure'),answer];
}

export function preferenceScore(a:Omit<Assessment,'score'>,weights:Preferences):number{
 return(a.density*weights.density+a.order*weights.order+a.coverage*weights.coverage+a.wall*weights.wall+a.dividers*weights.dividers)*20-Math.abs(a.density-.82)*45-a.blocked*1000+(a.banquette??0)*12-Math.max(0,(a.usableEmptyRadius??a.emptyRadius??0)-2.3)*40+(a.comfort??1)*24+(a.structure??0)*24+(a.circulation??1)*20-(a.waste??0)*weights.coverage*45-(a.deadEnds??0)*50-(a.aisleExcess??0)*80;
}
export function assess(layout:Layout,weights:Preferences=defaultPreferences):Assessment{
 const tables=layout.items.filter(i=>['two','four','table'].includes(i.kind)),walls=edges(layout.outline),nav=createNavigator(layout.items,layout.outline,spawnPoint(layout.outline,layout.items),{services:false});
 const blocked=tables.filter(i=>i.kind!=='table'&&!customerSeatAccess(i,nav)).length+smallTableGroups(layout.items).filter(g=>!smallGroupAccess(g,nav)).length+[...nav.kitchens,...(nav.restroom?[nav.restroom]:[])].filter(p=>!nav.reachable(p.point,.35)).length+layout.items.filter(i=>['serviceTable','drinkbar','checkout'].includes(i.kind)&&!nav.reachable({x:i.x-Math.sin(i.rotation*Math.PI/180)*.85,z:i.z+Math.cos(i.rotation*Math.PI/180)*.85},.3)).length;
 const density=Math.min(1.5,diningCost(layout.items)/Math.max(1,area(layout.outline)/8));
 const order=tables.filter(i=>tables.some(j=>j!==i&&i.rotation%180===j.rotation%180&&(Math.abs(i.x-j.x)<.12||Math.abs(i.z-j.z)<.12))).length/Math.max(1,tables.length);
 const wall=tables.filter(i=>walls.some(e=>{const t=(i.x-e.a.x)*e.tx+(i.z-e.a.z)*e.tz;return t>=0&&t<=e.length&&Math.abs((i.x-e.a.x)*e.nx+(i.z-e.a.z)*e.nz)<CATALOG[i.kind].w/2+.35;})||layout.items.some(p=>['partition','dividerWall'].includes(p.kind)&&Math.hypot(i.x-p.x,i.z-p.z)<2)).length/Math.max(1,tables.length);
 let samples=0,unused=0,emptyRadius=0;const entry=entrance(layout.outline);const xs=layout.outline.map(p=>p.x),zs=layout.outline.map(p=>p.z);
 for(let x=Math.min(...xs)+1;x<Math.max(...xs);x+=.5)for(let z=Math.min(...zs)+1;z<Math.max(...zs);z+=.5){
  if(!rectInRoom({x,z,w:1,d:1,rotation:0},layout.outline,.1))continue;samples++;
  const distance=Math.min(...layout.items.filter(i=>!isArt(i.kind)&&i.kind!=='robot').map(i=>{const a=i.rotation*Math.PI/180,dx=x-i.x,dz=z-i.z,r=bounds(i);return Math.hypot(Math.max(0,Math.abs(dx*Math.cos(a)+dz*Math.sin(a))-r.w/2),Math.max(0,Math.abs(-dx*Math.sin(a)+dz*Math.cos(a))-r.d/2));}));
  if(distance>1.4)unused++;if(Math.hypot(x-entry.x,z-entry.z)>3.5)emptyRadius=Math.max(emptyRadius,distance);
 }
 const banquette=layout.items.some(i=>i.kind==='bench')&&smallTableGroups(layout.items).some(g=>g.length===3||g.length===4)?1:0;
 const dividers=Math.min(1,layout.items.filter(i=>['partition','dividerWall'].includes(i.kind)).length/Math.max(6,area(layout.outline)/15));
 const quality=spatialQuality(layout,nav);
 const coverage=1-unused/Math.max(1,samples),score=preferenceScore({...quality,density,order,coverage,wall,dividers,banquette,emptyRadius,blocked,tables:tables.length,seats:layout.items.reduce((n,i)=>n+CATALOG[i.kind].seats,0)},weights);
 return{...quality,tables:tables.length,seats:layout.items.reduce((n,i)=>n+CATALOG[i.kind].seats,0),blocked,density,order,coverage,wall,dividers,banquette,emptyRadius,score};
}
export function proposals(layout:Layout,weights:Preferences=defaultPreferences,random=Math.random):Proposal[]{
 const candidates:Proposal[]=[];
 for(let n=0;n<6&&candidates.length<4;n++){
  try{const next=randomArrangement(layout,random);candidates.push({layout:next,assessment:assess(next,weights)});}
  catch(error){if(!(error instanceof LayoutPlanningError)||n===5&&!candidates.length)throw error;}
 }
 return candidates.filter(p=>p.assessment.blocked===0&&p.assessment.tables>0).sort((a,b)=>b.assessment.score-a.assessment.score);
}
// Only direct, measurable answers tune candidate ranking. Other issues are retained
// with the entire plan for later design-rule changes; safety checks stay mandatory.
export function learn(weights:Preferences,feedback:Feedback):Preferences{
 const next={...weights};
 const changes:Partial<Record<AnswerId,Partial<Preferences>>>={
  'aisles-wide':{coverage:.18},'aisles-narrow':{coverage:-.18},
  'few-walls':{dividers:.22,wall:.1},'many-walls':{dividers:-.22},
  'many-tables':{density:-.18},'few-tables':{density:.18},
  'empty-space':{coverage:.18},'unaligned':{order:.2},'wall-seats':{wall:.2},'wall-route':{wall:.2}
 };
 const deltas:Partial<Preferences>={};
 const seen=new Set<AnswerId>();
 for(const answer of feedback.answers){if(seen.has(answer.id))continue;seen.add(answer.id);
  for(const [key,value] of Object.entries(changes[answer.id]??{})){const k=key as keyof Preferences;deltas[k]=(deltas[k]??0)+value!;}
 }
 for(const [key,value] of Object.entries(deltas)){const k=key as keyof Preferences;next[k]=Math.max(.35,Math.min(2.5,next[k]+Math.max(-.22,Math.min(.22,value!))));}

 return next;
}
