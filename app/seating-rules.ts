import {bounds,type Item,type Point,type Rect} from './floor-plan';
import type {createNavigator} from './robot-navigation';
// The bench seam grid (1.84m) is independent from the 0.82m table grid.
export function banquetteRun(id:string,x:number,z:number,rotation:number,groups:number[]){
 const pitch=.82,gap=1.15,used=groups.reduce((n,c)=>n+c*pitch,0)+(groups.length-1)*gap;
 const benches=Math.ceil(used/1.84),length=benches*1.84,items:Item[]=[],aisles:Rect[]=[];
 const a=rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 const local=(kind:Item['kind'],u:number,v:number,turn=0):Item=>({id:`${id}-${kind}-${items.length}`,kind,x:x+c*u-s*v,z:z+s*u+c*v,rotation:(rotation+turn)%360});
 const rect=(u:number,v:number,w:number,d:number):Rect=>({x:x+c*u-s*v,z:z+s*u+c*v,w,d,rotation});
 for(let n=0;n<benches;n++)items.push(local('bench',-length/2+.92+n*1.84,0));
 let cursor=-used/2;
 for(const [n,count] of groups.entries()){
  for(let k=0;k<count;k++){const u=cursor+pitch*(k+.5);items.push(local('table',u,-.85),local('chair',u,-1.5,180));}
  cursor+=count*pitch;
  if(n<groups.length-1){aisles.push(rect(cursor+gap/2,-1.3,gap,1.8));cursor+=gap;}
 }
 aisles.push(rect(0,-2.45,length+1.5,1.35));
 return{items,aisles,length,groups};
}
export function smallTableGroups(items:Item[]):Item[][]{
 const remaining=new Set(items.filter(i=>i.kind==='table').map(i=>i.id)),tables=items.filter(i=>i.kind==='table'),groups:Item[][]=[];
 for(const first of tables){if(!remaining.delete(first.id))continue;const group=[first];
  for(let n=0;n<group.length;n++){const t=group[n],a=t.rotation*Math.PI/180;for(const q of tables){if(!remaining.has(q.id)||q.rotation%180!==t.rotation%180)continue;const dx=q.x-t.x,dz=q.z-t.z;if(Math.abs(-dx*Math.sin(a)+dz*Math.cos(a))<.16&&Math.abs(dx*Math.cos(a)+dz*Math.sin(a))<.96){remaining.delete(q.id);group.push(q);}}}
  groups.push(group);
 }
 return groups;
}
export function smallGroupAccess(group:Item[],nav:ReturnType<typeof createNavigator>){
 const a=group[0].rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),u=group.map(t=>t.x*c+t.z*s),v=group.reduce((n,t)=>n-t.x*s+t.z*c,0)/group.length;
 return[Math.min(...u)-.86,Math.max(...u)+.86].some(end=>nav.reachable({x:c*end-s*v,z:s*end+c*v},.3));
}
export const diningCost=(items:Item[])=>items.reduce((n,i)=>n+(['two','four'].includes(i.kind)?1:i.kind==='table'?.5:0),0);
export function checkoutStaffArea(item:Item):Rect{const a=item.rotation*Math.PI/180;return{x:item.x+Math.sin(a)*.66,z:item.z-Math.cos(a)*.66,w:1.3,d:.6,rotation:item.rotation};}
