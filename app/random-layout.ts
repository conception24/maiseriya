import {placementError,spawnPoint,snapArt,edges,entrance,type Layout,type Item,type Point,type Kind} from './floor-plan';
import {createNavigator} from './robot-navigation';
export function randomRoom(random= Math.random):Point[]{const w=10+Math.floor(random()*5),d=12+Math.floor(random()*5),cut=random()<.5?0:2;return [{x:-w/2+cut,z:-d/2},{x:w/2,z:-d/2},{x:w/2,z:d/2},{x:-w/2,z:d/2},...(cut?[{x:-w/2,z:-d/2+cut}]:[])];}
export function randomArrangement(layout:Layout,random=Math.random):Layout{
 const outline=layout.outline,items:Item[]=[],entry=entrance(outline),xs=outline.map(p=>p.x),zs=outline.map(p=>p.z),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);let serial=0;
 const add=(kind:Kind,x:number,z:number,rotation=0)=>{const i={id:`random-${serial++}`,kind,x,z,rotation};if(!placementError(i,items,outline)){items.push(i);return true;}return false;};
 const offset=random()*.45;
 // Regular rows retain 1.3 m cross aisles; the central entrance aisle stays open.
 for(let z=minZ+1.5;z<maxZ-2;z+=3.55)for(let x=minX+1.25+offset;x<maxX-1.1;x+=3.35){if(Math.abs(x-entry.x)<1.55||random()<.12)continue;add(random()<.65?'four':'two',x,z);}
 const spawn=spawnPoint(outline,items),nav=createNavigator(items,outline,spawn),reachable=new Set(nav.services.map(s=>s.tableId));for(let n=items.length-1;n>=0;n--)if(!reachable.has(items[n].id))items.splice(n,1);
 for(let z=maxZ-2;z>minZ+1&&items.filter(i=>i.kind==='robot').length<3;z-=1)for(let x=entry.x-1;x<=entry.x+1;x+=1){if(items.filter(i=>i.kind==='robot').length>=3)break;const q={x,z};if(nav.route(spawn,q).length)add('robot',x,z);}
 for(const e of edges(outline)){if(e.i===entry.i||e.length<3)continue;const art=snapArt({id:`random-${serial++}`,kind:random()<.5?'athens':'primavera',x:(e.a.x+e.b.x)/2,z:(e.a.z+e.b.z)/2,rotation:0},outline);if(!placementError(art,items,outline))items.push(art);}
 return {...layout,items};
}
