import {placementError,spawnPoint,snapArt,edges,entrance,type Layout,type Item,type Point,type Kind} from './floor-plan';
import {createNavigator} from './robot-navigation';
export function randomRoom(random= Math.random):Point[]{const w=10+Math.floor(random()*5),d=12+Math.floor(random()*5),cut=random()<.5?0:2;return [{x:-w/2+cut,z:-d/2},{x:w/2,z:-d/2},{x:w/2,z:d/2},{x:-w/2,z:d/2},...(cut?[{x:-w/2,z:-d/2+cut}]:[])];}
export function randomArrangement(layout:Layout,random=Math.random):Layout{
 const outline=layout.outline,items:Item[]=[],entry=entrance(outline),xs=outline.map(p=>p.x),zs=outline.map(p=>p.z),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);let serial=0;
 const add=(kind:Kind,x:number,z:number,rotation=0)=>{const i={id:`random-${serial++}`,kind,x,z,rotation};if(!placementError(i,items,outline)){items.push(i);return true;}return false;};
 // 1.55 m main aisles, with three booths joined back-to-back per block.
 const columns:number[]=[];for(const sign of [-1,1]){const space=sign>0?maxX-entry.x:entry.x-minX;const sideAisle=Math.min(1.55,space-.12-.92-1.695-1.84);for(let n=0;n<(sideAisle>=.75?2:1);n++){const x=entry.x+sign*(1.695+n*(1.84+sideAisle));if(x-.92>minX+.09&&x+.92<maxX-.09)columns.push(x);}}
 const start=minZ+1.25+random()*.15;
 for(let row=0,z=start;z<maxZ-2;row++,z+=2.22+(row%3===0?1.55:0))for(const x of columns)add('four',x,z);
 const spawn=spawnPoint(outline,items),nav=createNavigator(items,outline,spawn),reachable=new Set(nav.services.map(s=>s.tableId));for(let n=items.length-1;n>=0;n--)if(!reachable.has(items[n].id))items.splice(n,1);
 for(let z=maxZ-2;z>minZ+1&&items.filter(i=>i.kind==='robot').length<3;z-=1)for(let x=entry.x-1;x<=entry.x+1;x+=1){if(items.filter(i=>i.kind==='robot').length>=3)break;const q={x,z};if(nav.route(spawn,q).length)add('robot',x,z);}
 const artworks:Kind[]=['venus','primavera','cherubs','adam','annunciation','athens'];
 for(const e of edges(outline)){for(let t=1.3;t<e.length-1.1;t+=2.5){if(e.i===entry.i&&Math.abs(t-e.length/2)<2)continue;const art=snapArt({id:`random-${serial++}`,kind:artworks[Math.floor(random()*artworks.length)],x:e.a.x+t*e.tx,z:e.a.z+t*e.tz,rotation:0},outline);if(!placementError(art,items,outline))items.push(art);}}
 return {...layout,items};
}

