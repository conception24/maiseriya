import {placementError,snap,snapPlacement,entrance,bounds,fitsTray,TRAY_WIDTH,TRAY_DEPTH,type Item,type Point} from './floor-plan';
import {corners,intersects} from './geometry';
export function selectionBox(a:Point,b:Point){return{x:(a.x+b.x)/2,z:(a.z+b.z)/2,w:Math.abs(a.x-b.x),d:Math.abs(a.z-b.z),rotation:0};}
export function selectInBox(items:Item[],a:Point,b:Point){const box=selectionBox(a,b);return items.filter(i=>intersects(bounds(i),box)).map(i=>i.id);}
export function deleteSelection(items:Item[],ids:string[]){const selected=new Set(ids);return items.filter(i=>!selected.has(i.id));}

// Translate the selection as one rigid group, never snap its members independently.
export function translateSelection(items:Item[],ids:string[],dx:number,dz:number){const selected=new Set(ids),x=snap(dx),z=snap(dz);return items.map(i=>selected.has(i.id)?{...i,x:i.x+x,z:i.z+z}:i);}
export function selectionMoveError(items:Item[],ids:string[],outline:Point[]){const selected=new Set(ids);for(const i of items)if(selected.has(i.id)){const error=editorPlacementError(i,items,outline);if(error)return error;}return null;}

// Allocate IDs once per gesture so copy previews and committed selection stay stable.
export function copySelection(items:Item[],ids:string[],newId:()=>string=()=>crypto.randomUUID()){const selected=new Set(ids);return items.filter(i=>selected.has(i.id)).map(i=>({...i,id:newId()}));}

export function trayOrigin(outline:Point[]):Point {
 const zs=outline.map(p=>p.z);
 return {x:Math.max(...outline.map(p=>p.x))+2.6, z:(Math.min(...zs)+Math.max(...zs)-TRAY_DEPTH)/2};
}

export function onTray(item:Point,outline:Point[]) {
 const origin=trayOrigin(outline);
 return item.x>=origin.x && item.x<=origin.x+TRAY_WIDTH && item.z>=origin.z && item.z<=origin.z+TRAY_DEPTH;
}

export function splitEditorItems(items:Item[],outline:Point[]) {
 const origin=trayOrigin(outline), placed:Item[]=[], staged:Item[]=[];
 for(const i of items) {
  if(onTray(i,outline)) staged.push({...i,x:i.x-origin.x,z:i.z-origin.z});
  else placed.push(i);
 }
 return {items:placed,staged};
}

export function editorPlacementError(item:Item,items:Item[],outline:Point[]) {
 if(onTray(item,outline)) {
  const origin=trayOrigin(outline);
  if(!fitsTray({...item,x:item.x-origin.x,z:item.z-origin.z}))return '一時置き場の枠内に収めてください';
  if(items.some(other=>other.id!==item.id && onTray(other,outline) && intersects(bounds(item),bounds(other),-.0001)))return '一時置き場の家具が重なっています';
  return null;
 }
 return placementError(item,items.filter(i=>!onTray(i,outline)),outline);
}

export function snapForEditor(raw:Item,items:Item[],outline:Point[]):Item {
 if(onTray(raw,outline)) {
  const origin=trayOrigin(outline);
  return {...raw,x:origin.x+snap(raw.x-origin.x),z:origin.z+snap(raw.z-origin.z)};
 }
 const placed=items.filter(i=>!onTray(i,outline));
 if(raw.kind==='stool') {
  const e=entrance(outline);
  const normal=(raw.x-e.x)*e.nx+(raw.z-e.z)*e.nz;
  if(normal<0 && normal>=-.8){
   const along=snap((raw.x-e.x)*e.tx+(raw.z-e.z)*e.tz);
   return {...raw,side:'outside',x:e.x+along*e.tx-.39*e.nx,z:e.z+along*e.tz-.39*e.nz};
  }
  if(raw.side==='outside')raw={...raw,side:undefined};
 }
 return snapPlacement(raw,placed,outline);
}

// Rotate the whole footprint about its centre, without snapping members separately.
export function rotateSelection(items:Item[],ids:string[]) {
 const selected=new Set(ids), group=items.filter(i=>selected.has(i.id));
 if(!group.length)return items;
 const points=group.flatMap(item=>corners(bounds(item)));
 const x=(Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x)))/2;
 const z=(Math.min(...points.map(p=>p.z))+Math.max(...points.map(p=>p.z)))/2;
 return items.map(i=>selected.has(i.id)?{...i,x:x-(i.z-z),z:z+(i.x-x),rotation:((i.rotation+90)%360+360)%360}:i);
}
