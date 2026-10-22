import {createNavigator} from './robot-navigation';
import {spawnPoint,type Item,type Point} from './floor-plan';
export type RobotState=Point&{id:string;number:number;status:string;yaw:number;hidden:boolean;phase:string;cargo:'food'|'plates'|'empty';variant:number;tableId:string};
export type ServiceEvent={type:'delivered'|'collected';tableId:string;variant:number};
export function createFleet(items:Item[],outline:Point[]){
 const placed=items.filter(i=>i.kind==='robot'),first=placed[0],shared=createNavigator(items,outline,first??spawnPoint(outline,items)),kitchen=shared.kitchen,kitchens=shared.kitchens,portals=kitchens.map(()=>({owner:""}));
 type Phase='outbound'|'service'|'return'|'enter'|'hidden'|'exit';
 const robots=placed.map((i,index)=>({kitchen:kitchens[index%kitchens.length]??null,portal:portals[index%portals.length]??{owner:""},id:i.id,number:index+1,x:i.x,z:i.z,yaw:-i.rotation*Math.PI/180,status:'出発準備中',nav:createNavigator(items,outline,i),path:[] as Point[],wait:index*.4,blocked:0,goalIndex:index,target:{x:i.x,z:i.z},home:{x:i.x,z:i.z},phase:'outbound' as Phase,hidden:false,cargo:'food' as RobotState['cargo'],variant:index,tableId:'',collect:false}));
 const events:ServiceEvent[]=[];
 function plan(r:typeof robots[number],others:Point[]){const goals=r.nav.services;for(let n=0;n<goals.length;n++){const goal=goals[r.goalIndex++%goals.length];if(robots.some(o=>o!==r&&o.tableId===goal.tableId&&['outbound','service'].includes(o.phase)))continue;const route=r.nav.route(r,goal.point,others);if(route.length||Math.hypot(r.x-goal.point.x,r.z-goal.point.z)<.05){r.tableId=goal.tableId;r.target=goal.point;r.path=route;return true;}}return false;}
 function move(r:typeof robots[number],target:Point,dt:number,others:Point[]){const dx=target.x-r.x,dz=target.z-r.z,d=Math.hypot(dx,dz),step=Math.min(d,.9*dt),next=d?{x:r.x+dx/d*step,z:r.z+dz/d*step}:r;if(others.some(o=>Math.hypot(next.x-o.x,next.z-o.z)<.59))return false;r.x=next.x;r.z=next.z;if(d>.001)r.yaw=Math.atan2(-dx,-dz);return d<=step+.00001;}
 return{ kitchen,kitchens,restroom:shared.restroom,drainEvents(){return events.splice(0);},states:():RobotState[]=>robots.map(({id,number,x,z,yaw,status,hidden,phase,cargo,variant,tableId})=>({id,number,x,z,yaw,status,hidden,phase,cargo,variant,tableId})),step(dt:number,person:Point,paused:boolean){
  for(const r of robots){const kitchen=r.kitchen;const others=robots.filter(o=>o!==r&&!o.hidden);
   if(paused){r.status='一時停止中';continue;}
   if(r.portal.owner===r.id&&r.phase==='outbound'&&kitchen&&Math.hypot(r.x-kitchen.point.x,r.z-kitchen.point.z)>1.1)r.portal.owner='';
   if(r.phase==='return'&&kitchen){if(r.portal.owner&&r.portal.owner!==r.id){r.phase='outbound';r.path=[];r.collect=!r.collect;r.variant=(r.variant+1)%8;r.cargo=r.collect?'empty':'food';r.tableId='';}else r.portal.owner=r.id;}
   if(r.phase==='hidden'){r.status='厨房で積み替え中';r.wait-=dt;if(r.wait<=0&&(!r.portal.owner||r.portal.owner===r.id)&&kitchen&&others.every(o=>Math.hypot(o.x-kitchen.point.x,o.z-kitchen.point.z)>.8)){r.portal.owner=r.id;r.hidden=false;r.phase='exit';r.collect=!r.collect;r.variant=(r.variant+3)%8;r.cargo=r.collect?'empty':'food';}continue;}
   if(Math.hypot(person.x-r.x,person.z-r.z)<.75){r.status='人を待っています';continue;}
   if(r.phase==='enter'||r.phase==='exit'){if(!kitchen)continue;const target=r.phase==='enter'?kitchen.outside:kitchen.point;r.status=r.phase==='enter'?'厨房へ入ります':'厨房から出ます';if(move(r,target,dt,others)){if(r.phase==='enter'){r.hidden=true;r.phase='hidden';r.wait=.8;}else{r.phase='outbound';r.path=[];r.tableId='';}}continue;}
   if(r.wait>0){r.wait-=dt;continue;}
   if(r.phase==='service'){events.push({type:r.collect?'collected':'delivered',tableId:r.tableId,variant:r.variant});r.cargo=r.collect?'plates':'empty';r.phase='return';r.path=[];r.tableId='';}
   if(!r.path.length){if(r.phase==='return'){r.target=kitchen?.point??r.home;r.path=r.nav.route(r,r.target,others);if(Math.hypot(r.x-r.target.x,r.z-r.target.z)<.06){if(kitchen){if(r.portal.owner&&r.portal.owner!==r.id){r.status='厨房の順番待ち';continue;}r.portal.owner=r.id;r.phase='enter';}else{r.phase='outbound';r.collect=!r.collect;r.variant=(r.variant+3)%8;r.cargo=r.collect?'empty':'food';r.wait=3;r.status='厨房への通路がありません';}continue;}}else if(!plan(r,others)){r.status='配膳できる席・通路を待っています';r.wait=1;continue;}}
   if(!r.path.length){if(r.phase==='outbound'&&r.tableId){r.phase='service';r.wait=.65;r.status=r.collect?'食器を回収しています':'料理をお届けしています';}else{r.status='通れる経路を待っています';r.wait=.8;}continue;}
   r.status=r.phase==='return'?'厨房へ戻っています':r.collect?'食器を回収しに行きます':'料理を運んでいます';const before={x:r.x,z:r.z};
   if(move(r,r.path[0],dt,others)){r.path.shift();if(!r.path.length&&r.phase==='outbound'){r.phase='service';r.wait=2;r.status=r.collect?'食器を回収しています':'料理をお届けしています';}}
   if(Math.hypot(before.x-r.x,before.z-r.z)<.00001){r.blocked+=dt;r.status='ほかのロボットに道を譲っています';if(r.blocked>1.2){r.path=r.nav.route(r,r.target,others);if(!r.path.length){if(r.portal.owner===r.id)r.portal.owner='';r.phase='outbound';r.tableId='';plan(r,others);}r.blocked=0;}}else r.blocked=0;
  }
 }};
}

