import {placementError,snap,bounds,type Item,type Point} from './floor-plan';
import {intersects} from './geometry';
export function selectionBox(a:Point,b:Point){return{x:(a.x+b.x)/2,z:(a.z+b.z)/2,w:Math.abs(a.x-b.x),d:Math.abs(a.z-b.z),rotation:0};}
export function selectInBox(items:Item[],a:Point,b:Point){const box=selectionBox(a,b);return items.filter(i=>intersects(bounds(i),box)).map(i=>i.id);}
export function deleteSelection(items:Item[],ids:string[]){const selected=new Set(ids);return items.filter(i=>!selected.has(i.id));}

// Translate the selection as one rigid group, never snap its members independently.
export function translateSelection(items:Item[],ids:string[],dx:number,dz:number){const selected=new Set(ids),x=snap(dx),z=snap(dz);return items.map(i=>selected.has(i.id)?{...i,x:i.x+x,z:i.z+z}:i);}
export function selectionMoveError(items:Item[],ids:string[],outline:Point[]){const selected=new Set(ids);for(const i of items)if(selected.has(i.id)){const error=placementError(i,items,outline);if(error)return error;}return null;}
