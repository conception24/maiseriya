import {edges,type Item,type Point} from './floor-plan';
export const tableWidth=(i:Item)=>['four','wideTable'].includes(i.kind)?1.53:.82;
export function rackSide(item:Item,items:Item[],outline:Point[]):number {
 const a=item.rotation*Math.PI/180,ux=Math.cos(a),uz=Math.sin(a),w=tableWidth(item);
 for(const other of items){if(other.id===item.id||!['two','four','table','wideTable'].includes(other.kind)||((other.rotation-item.rotation)%180+180)%180!==0)continue;const dx=other.x-item.x,dz=other.z-item.z,along=dx*ux+dz*uz,cross=-dx*uz+dz*ux;if(Math.abs(cross)<.04&&Math.abs(Math.abs(along)-(w+tableWidth(other))/2)<.16)return Math.sign(along);}
 // Measure the actual wall segment, not its midpoint. Interior screens also
 // count as walls so the menu rack stays off the guest's open approach side.
 const segments=edges(outline).map(e=>({a:e.a,b:e.b}));
 for(const p of items.filter(i=>i.kind==='partition')){const r=p.rotation*Math.PI/180,dx=Math.cos(r)*.9,dz=Math.sin(r)*.9;segments.push({a:{x:p.x-dx,z:p.z-dz},b:{x:p.x+dx,z:p.z+dz}});}
 const distance=(sign:number)=>Math.min(...segments.map(e=>{const x=item.x+sign*w/2*ux,z=item.z+sign*w/2*uz,dx=e.b.x-e.a.x,dz=e.b.z-e.a.z,t=Math.max(0,Math.min(1,((x-e.a.x)*dx+(z-e.a.z)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-e.a.x-t*dx,z-e.a.z-t*dz);}));
 return distance(-1)<=distance(1)?-1:1;
}

// Join only genuinely touching small tables; a gap remains a separate party.
export function rackOwner(item:Item,items:Item[]):boolean {
 if(item.kind!=='table')return true;
 const group=[item],seen=new Set([item.id]),tables=items.filter(i=>i.kind==='table');
 for(let n=0;n<group.length;n++){
  const t=group[n],a=t.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  for(const q of tables){if(seen.has(q.id)||((q.rotation-t.rotation)%180+180)%180!==0)continue;
   const dx=q.x-t.x,dz=q.z-t.z,along=dx*c+dz*s,cross=-dx*s+dz*c;
   if(Math.abs(cross)<.04&&Math.abs(Math.abs(along)-.82)<.035){seen.add(q.id);group.push(q);}
  }
 }
 const a=item.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 group.sort((x,y)=>(x.x*c+x.z*s)-(y.x*c+y.z*s)||x.id.localeCompare(y.id));
 return group[Math.floor((group.length-1)/2)].id===item.id;
}

