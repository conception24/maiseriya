import {edges,type Item,type Point} from './floor-plan';
export const tableWidth=(i:Item)=>['four','wideTable'].includes(i.kind)?1.53:.82;
export function rackSide(item:Item,items:Item[],outline:Point[]):number {
 const a=item.rotation*Math.PI/180,ux=Math.cos(a),uz=Math.sin(a),w=tableWidth(item);
 for(const other of items){if(other.id===item.id||!['two','four','table','wideTable'].includes(other.kind)||((other.rotation-item.rotation)%180+180)%180!==0)continue;const dx=other.x-item.x,dz=other.z-item.z,along=dx*ux+dz*uz,cross=-dx*uz+dz*ux;if(Math.abs(cross)<.04&&Math.abs(Math.abs(along)-(w+tableWidth(other))/2)<.16)return Math.sign(along);}
 const distance=(sign:number)=>Math.min(...edges(outline).map(e=>{const x=item.x+sign*w/2*ux,z=item.z+sign*w/2*uz;return Math.hypot(x-(e.a.x+e.b.x)/2,z-(e.a.z+e.b.z)/2);}));return distance(-1)<=distance(1)?-1:1;
}
