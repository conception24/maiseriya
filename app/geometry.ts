export type Point={x:number;z:number};
export type Rect=Point&{w:number;d:number;rotation:number};
export const DEFAULT_OUTLINE:Point[]=[{x:-6,z:-8.5},{x:6,z:-8.5},{x:6,z:6.5},{x:-6,z:6.5}];
export const area=(p:Point[])=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a.x*b.z-b.x*a.z;},0)/2;
export function edges(p:Point[]){return p.map((a,i)=>{const b=p[(i+1)%p.length],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);return{a,b,i,length,tx:dx/length,tz:dz/length,nx:-dz/length,nz:dx/length,angle:Math.atan2(dz,dx)*180/Math.PI};});}
export function segmentDistance(p:Point,a:Point,b:Point){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)));return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);}
export function inside(p:Point,polygon:Point[]){let result=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)result=!result;}return result;}
function cross(a:Point,b:Point,c:Point){return(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);}
function segmentsTouch(a:Point,b:Point,c:Point,d:Point){return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||Math.min(segmentDistance(a,c,d),segmentDistance(b,c,d),segmentDistance(c,a,b),segmentDistance(d,a,b))<.00001;}
export function outlineError(p:Point[]):string|null{
 if(!Array.isArray(p)||p.length<3||p.length>32||p.some(q=>!q||!Number.isFinite(q.x)||!Number.isFinite(q.z)||Math.abs(q.x)>15||q.z< -16||q.z>14))return '角は3〜32個、部屋は30m四方の範囲にしてください';
 const es=edges(p);if(es.some(e=>e.length<.5))return '壁の長さは50cm以上にしてください';if(area(p)<9)return '部屋は時計回りに、9m²以上の広さにしてください';
 for(let i=0;i<es.length;i++)for(let j=i+1;j<es.length;j++){if(j===i+1||i===0&&j===es.length-1)continue;if(segmentsTouch(es[i].a,es[i].b,es[j].a,es[j].b))return '壁が交差しています';}
 if(!es.some(e=>e.length>=2.4))return '入口のために2.4m以上の壁を1本つくってください';return null;
}
export function entrance(p:Point[]){const wall=edges(p).filter(e=>e.length>=2.4).sort((a,b)=>(b.a.z+b.b.z)-(a.a.z+a.b.z))[0]||edges(p)[0];return{...wall,width:Math.min(3.2,wall.length-.4),x:(wall.a.x+wall.b.x)/2,z:(wall.a.z+wall.b.z)/2};}
export function corners(r:Rect):Point[]{const a=r.rotation*Math.PI/180,c=Math.cos(a),sn=Math.sin(a);return[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>({x:r.x+x*r.w/2*c-z*r.d/2*sn,z:r.z+x*r.w/2*sn+z*r.d/2*c}));}
const orientations=new Map<number,{c:number;s:number}>();
function orientation(rotation:number){let frame=orientations.get(rotation);if(!frame){const a=rotation*Math.PI/180;frame={c:Math.abs(Math.cos(a)),s:Math.abs(Math.sin(a))};if(orientations.size>128)orientations.clear();orientations.set(rotation,frame);}return frame;}
export function intersects(a:Rect,b:Rect,gap=0){
 // Conservative broad phase. Keep the original SAT for touching/nearby or
 // angled rectangles, so early rejection cannot change placement decisions.
 const ac=orientation(a.rotation),bc=orientation(b.rotation),aw=Math.abs(a.w+gap)/2,ad=Math.abs(a.d+gap)/2,bw=Math.abs(b.w+gap)/2,bd=Math.abs(b.d+gap)/2;
 if(Math.abs(a.x-b.x)>ac.c*aw+ac.s*ad+bc.c*bw+bc.s*bd+1e-10||Math.abs(a.z-b.z)>ac.s*aw+ac.c*ad+bc.s*bw+bc.c*bd+1e-10)return false;
 const aa=corners({...a,w:a.w+gap,d:a.d+gap}),bb=corners({...b,w:b.w+gap,d:b.d+gap});for(const r of[a,b])for(const angle of[r.rotation,r.rotation+90]){const rad=angle*Math.PI/180,project=(p:Point)=>p.x*Math.cos(rad)+p.z*Math.sin(rad),ap=aa.map(project),bp=bb.map(project);if(Math.max(...ap)<=Math.min(...bp)||Math.max(...bp)<=Math.min(...ap))return false;}return true;}
export function rectInRoom(r:Rect,p:Point[],margin=.12){const cs=corners(r);if(cs.some(c=>!inside(c,p)||edges(p).some(e=>segmentDistance(c,e.a,e.b)<margin)))return false;return !edges(p).some(e=>cs.some((a,j)=>segmentsTouch(a,cs[(j+1)%4],e.a,e.b)));}
export function circleClear(x:number,z:number,rects:Rect[],polygon=DEFAULT_OUTLINE,radius=.19){if(!inside({x,z},polygon)||edges(polygon).some(e=>segmentDistance({x,z},e.a,e.b)<radius+.09))return false;return !rects.some(r=>{const a=-r.rotation*Math.PI/180,dx=x-r.x,dz=z-r.z,lx=dx*Math.cos(a)-dz*Math.sin(a),lz=dx*Math.sin(a)+dz*Math.cos(a),cx=Math.max(-r.w/2,Math.min(r.w/2,lx)),cz=Math.max(-r.d/2,Math.min(r.d/2,lz));return(lx-cx)**2+(lz-cz)**2<radius**2;});}

// Prepared navigation collision checker. Cache only wall tests on the 1/16m
// sweep lattice; furniture changes still get an independent collision index.
type WallField={signature:string;byRadius:Map<number,{clear:(x:number,z:number)=>boolean}>};
const wallFields=new WeakMap<Point[],WallField>();
export function createCircleChecker(rects:Rect[],polygon:Point[],radius=.19){
 const signature=polygon.map(p=>`${p.x},${p.z}`).join(';');let field=wallFields.get(polygon);
 if(!field||field.signature!==signature){field={signature,byRadius:new Map()};wallFields.set(polygon,field);}
 let wall=field.byRadius.get(radius);
 if(!wall){const boundary=edges(polygon),cache=new Map<number,Map<number,boolean>>();
  const check=(x:number,z:number)=>inside({x,z},polygon)&&!boundary.some(e=>segmentDistance({x,z},e.a,e.b)<radius+.09);
  wall={clear(x,z){const sx=x*16,sz=z*16;if(!Number.isInteger(sx)||!Number.isInteger(sz))return check(x,z);let column=cache.get(sx);const known=column?.get(sz);if(known!==undefined)return known;const clear=check(x,z);if(!column){column=new Map();cache.set(sx,column);}column.set(sz,clear);return clear;}};
  field.byRadius.set(radius,wall);
 }
 const frames=rects.map(r=>{const a=-r.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),hw=r.w/2,hd=r.d/2;return{x:r.x,z:r.z,c,s,hw,hd,ex:Math.abs(c)*hw+Math.abs(s)*hd+radius,ez:Math.abs(s)*hw+Math.abs(c)*hd+radius};});
 // One-metre buckets avoid scanning distant furniture for every grid sample.
 const cells=new Map<number,Map<number,typeof frames>>();
 for(const r of frames)for(let x=Math.floor(r.x-r.ex);x<=Math.floor(r.x+r.ex);x++){let column=cells.get(x);if(!column){column=new Map();cells.set(x,column);}for(let z=Math.floor(r.z-r.ez);z<=Math.floor(r.z+r.ez);z++){let list=column.get(z);if(!list){list=[];column.set(z,list);}list.push(r);}}
 const rr=radius*radius,wallClear=wall.clear;
 return(x:number,z:number)=>{
  if(!wallClear(x,z))return false;
  for(const r of cells.get(Math.floor(x))?.get(Math.floor(z))??[]){const dx=x-r.x,dz=z-r.z;if(Math.abs(dx)>r.ex||Math.abs(dz)>r.ez)continue;const lx=dx*r.c-dz*r.s,lz=dx*r.s+dz*r.c,cx=Math.max(-r.hw,Math.min(r.hw,lx)),cz=Math.max(-r.hd,Math.min(r.hd,lz));if((lx-cx)**2+(lz-cz)**2<rr)return false;}
  return true;
 };
}
