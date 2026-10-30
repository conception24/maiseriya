import {benchRearHandrail,continuousBenches,dividerHandrail,dividerSpan} from './seating-rules';
import * as T from 'three';
import {rackSide,rackOwner} from './table-arrangement';
import {recruitmentPosterSite,wallPlanterSites,fabricPanelSites} from './decor-placement';
import {createTableMeal} from './table-meals';
import { colliders, canWalk, DEFAULT_OUTLINE,edges,entrance,inside,spawnPoint,isArt,CATALOG,type Layout,type Point,type Item } from './floor-plan';
import {ARTWORKS} from './artworks';
import {intersects} from './geometry';
import {bounds} from './floor-plan';
import menuCover from './assets/menu-cover.jpg?inline';
import {createFleet,type RobotState} from './robot-fleet';
import {createNavigator} from './robot-navigation';
export type {RobotState} from './robot-fleet';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export type RoomAPI={sound:(enabled:boolean)=>void;stand:()=>void;look:(x:boolean,y:boolean)=>void;food:(enabled:boolean)=>void;robotPaused:(paused:boolean)=>void;reset:()=>void;move:(direction:string,active:boolean)=>void;lighting:(night:boolean)=>void;lens:(v:number)=>void;capture:()=>Promise<void>;dispose:()=>void};
export function createRoom(host:HTMLDivElement,items:Item[],onPosition:((x:number,z:number,yaw:number)=>void)|undefined,options:{outline?:Point[];chairStyle?:Layout['chairStyle'];foodEnabled?:boolean;drinkbarStyle?:'wood'|'tile';invertX?:boolean;invertY?:boolean;onSeat?:(state:{seated:boolean;hint:string})=>void;onRobot?:(state:RobotState[])=>void}={}):RoomAPI {
 const outline=options.outline??DEFAULT_OUTLINE,entry=entrance(outline),spawn=spawnPoint(outline,items);
 const scene=new T.Scene();scene.background=new T.Color('#d1d9d1');scene.fog=new T.Fog('#d2ccad',16,35);
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;host.appendChild(renderer.domElement);
 const camera=new T.PerspectiveCamera(65,1,.05,80);camera.rotation.order='YXZ';camera.position.set(spawn.x,1.62,spawn.z);const initialYaw=Math.atan2(-entry.nx,-entry.nz);let yaw=initialYaw,pitch=-.08;const obstacles=colliders(items);const keys=new Set<string>();
 const textures:T.Texture[]=[];const meals:T.Group[]=[],flatMenus:T.Group[]=[];let foodVisible=options.foodEnabled!==false,invertX=options.invertX??false,invertY=options.invertY??false,seated=false;const standingPosition={...spawn};const fleet=createFleet(items,outline,18+Math.random()*24),kitchens=fleet.kitchens,restroom=fleet.restroom;let activeTableId="";const mealByTable=new Map<string,T.Group>();
 function texture(draw:(c:CanvasRenderingContext2D)=>void,size=512){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d')!);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();textures.push(t);return t;}
 let seed=12;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
 const woodTex=texture(c=>{c.fillStyle='#b5824e';c.fillRect(0,0,512,512);for(let i=0;i<1400;i++){const y=rand()*512;c.strokeStyle=`rgba(${rand()>.5?'74,39,14':'230,187,116'},${rand()*.15})`;c.lineWidth=rand()*2;c.beginPath();c.moveTo(0,y);for(let x=0;x<=512;x+=32)c.lineTo(x,y+Math.sin(x*.015+i)*2);c.stroke();}});
 const weaveTex=texture(c=>{c.fillStyle='#c5aa72';c.fillRect(0,0,512,512);for(let y=0;y<512;y+=8){c.fillStyle=y%16?'#b49c69':'#d6bd88';c.fillRect(0,y,512,3);}for(let y=0;y<512;y+=32)for(let x=0;x<512;x+=32){c.fillStyle='#4c4831';c.beginPath();c.moveTo(x+16,y+7);c.lineTo(x+21,y+16);c.lineTo(x+16,y+25);c.lineTo(x+11,y+16);c.fill();}});
 const plasterTex=texture(c=>{c.fillStyle='#cb995b';c.fillRect(0,0,512,512);for(let i=0;i<28000;i++){c.fillStyle=rand()>.5?'#b9ac8610':'#ffffff20';c.fillRect(rand()*512,rand()*512,2,2);}});
 const mat=(color:string,roughness=.7,map?:T.Texture)=>new T.MeshStandardMaterial({color,roughness,...(map?{map}:{})});
 const wood=mat('#d6b484',.48,woodTex),darkwood=mat('#735539',.6,woodTex),top=mat('#f0d5a5',.4,woodTex),green=mat('#284f35',.55),piping=mat('#203e2b'),weave=mat('#ffffff',.85,weaveTex),wall=mat('#ffffff',1,plasterTex),metal=mat('#393a31',.38),cream=mat('#fff8da');
 function box(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material,parent:T.Object3D=scene,r=0){const mesh=new T.Mesh(r?new RoundedBoxGeometry(w,h,d,3,r):new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 function cyl(rt:number,rb:number,h:number,x:number,y:number,z:number,m:T.Material,parent:T.Object3D=scene){const a=new T.Mesh(new T.CylinderGeometry(rt,rb,h,20),m);a.position.set(x,y,z);a.castShadow=true;a.receiveShadow=true;parent.add(a);return a;}
 function rod(a:T.Vector3,b:T.Vector3,r:number,m:T.Material,p:T.Object3D){const d=b.clone().sub(a);const o=cyl(r,r,d.length(),0,0,0,m,p);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
 function tube(points:T.Vector3[],r:number,m:T.Material,p:T.Object3D){const mesh=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),32,r,8,false),m);mesh.castShadow=true;p.add(mesh);}
 function restroomIcons(c:CanvasRenderingContext2D,x:number,y:number,unit:number){
  const person=(cx:number,color:string,up:boolean)=>{c.fillStyle=color;c.beginPath();c.arc(cx,y,unit*.105,0,Math.PI*2);c.fill();c.beginPath();if(up){c.moveTo(cx,y+unit*.17);c.lineTo(cx-unit*.18,y+unit*.60);c.lineTo(cx+unit*.18,y+unit*.60);}else{c.moveTo(cx-unit*.18,y+unit*.17);c.lineTo(cx+unit*.18,y+unit*.17);c.lineTo(cx,y+unit*.60);}c.closePath();c.fill();};
  person(x,'#0075be',false);person(x+unit*.56,'#e60020',true);
 }
 // One polygon drives the floor, ceiling, solid walls, windows and entry.
 const tileTex=texture(c=>{
  c.fillStyle='#263b33';c.fillRect(0,0,512,512);
  // One repeated tile texture: fine, irregular, intermittent mineral veins.
  // Clip the stone pattern inside the grout so adjoining tiles never join.
  c.save();c.beginPath();c.rect(7,7,498,498);c.clip();
  for(let n=0;n<42;n++){
   const base=25+rand()*462,phase=rand()*Math.PI*2,phase2=rand()*Math.PI*2,amp=7+rand()*20,slope=(rand()-.5)*.15;
   const vein=(x:number)=>base+amp*Math.sin(x*.012+phase)+4*Math.sin(x*.04+phase2)+slope*(x-256);
   let x=12+rand()*38,end=180+rand()*320;
   while(x<end){const length=8+rand()*36,next=Math.min(end,x+length);c.beginPath();c.moveTo(x,vein(x));
    for(let u=x+5;u<next;u+=5)c.lineTo(u,vein(u));c.lineTo(next,vein(next));
    c.strokeStyle=n%4?'#c7d4c825':'#e2e9df35';c.lineWidth=.3+rand()*.8;c.stroke();
    if(rand()<.18){const direction=rand()<.5?-1:1;c.beginPath();c.moveTo(x,vein(x));c.quadraticCurveTo(x+length*.45,vein(x)+direction*5,x+length*.8,vein(x)+direction*(7+rand()*8));c.strokeStyle='#d3dfd026';c.lineWidth=.35;c.stroke();}
    x=next+3+rand()*22;
   }
  }
  c.restore();
  c.strokeStyle='#a6aaa3';c.lineWidth=2.5;c.strokeRect(0,0,512,512);
 });tileTex.wrapS=tileTex.wrapT=T.RepeatWrapping;tileTex.repeat.set(1/.6,1/.6);
 const shape=new T.Shape(outline.map(p=>new T.Vector2(p.x,-p.z)));const floor=new T.Mesh(new T.ShapeGeometry(shape),mat('#ffffff',.28,tileTex));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
 // Wooden flooring follows booth footprints and joined bench rows; the room shape clips its edges.
 const woodAreas=items.filter(i=>i.kind==='four'||(i.kind==='bench'&&items.some(q=>q.id!==i.id&&q.kind==='bench'&&q.rotation===i.rotation&&(()=>{const a=i.rotation*Math.PI/180,c=Math.cos(a),sn=Math.sin(a),dx=q.x-i.x,dz=q.z-i.z;return Math.abs(Math.abs(dx*c+dz*sn)-1.84)<.12&&Math.abs(-dx*sn+dz*c)<.12;})())));
 if(woodAreas.length){
  const minX=Math.min(...outline.map(p=>p.x)),maxX=Math.max(...outline.map(p=>p.x)),minZ=Math.min(...outline.map(p=>p.z)),maxZ=Math.max(...outline.map(p=>p.z));
  const width=maxX-minX,depth=maxZ-minZ,size=2048;
  const seatingFloor=texture(c=>{
   c.save();c.scale(size/width,size/depth);c.translate(-minX,-minZ);
   c.beginPath();
   for(const i of woodAreas){c.save();c.translate(i.x,i.z);c.rotate(i.rotation*Math.PI/180);if(i.kind==='four')c.rect(-.94,-1.12,1.88,2.24);else c.rect(-.92,-1.96,1.84,2.34);c.restore();}
   c.clip();c.fillStyle='#624028';c.fillRect(minX,minZ,width,depth);
   let row=0;for(let z=Math.floor(minZ/.14)*.14;z<maxZ;z+=.14,row++){
    c.fillStyle=row%3===0?'#805435':row%3===1?'#75482e':'#6d432d';c.fillRect(minX,z,width,.136);
    c.fillStyle='#41291e';c.fillRect(minX,z+.136,width,.004);
    for(let x=Math.floor(minX/1.2)*1.2-(row%2)*.6;x<maxX;x+=1.2){c.fillRect(x,z,.006,.136);}
    c.fillStyle='#b3845d44';for(let k=0;k<3;k++)c.fillRect(minX,z+.025+k*.036,width,.002);
   }
   c.restore();
  },size);
  const geometry=new T.ShapeGeometry(shape),uv=geometry.getAttribute('uv'),position=geometry.getAttribute('position');
  for(let n=0;n<position.count;n++)uv.setXY(n,(position.getX(n)-minX)/width,(position.getY(n)+maxZ)/depth);
  const woodFloor=new T.Mesh(geometry,new T.MeshStandardMaterial({map:seatingFloor,transparent:true,depthWrite:false,roughness:.66}));woodFloor.rotation.x=-Math.PI/2;woodFloor.position.y=.004;woodFloor.receiveShadow=true;scene.add(woodFloor);
 }
 const ceiling=new T.Mesh(new T.ShapeGeometry(shape),new T.MeshStandardMaterial({color:'#e9e0c7',side:T.DoubleSide}));ceiling.rotation.x=-Math.PI/2;ceiling.position.y=3.3;scene.add(ceiling);
 const outsideWalkers:{person:T.Group;legs:T.Group[];span:number;phase:number;speed:number;edge:ReturnType<typeof edges>[number]}[]=[];
 for(const e of edges(outline)){const g=new T.Group();g.position.set((e.a.x+e.b.x)/2,0,(e.a.z+e.b.z)/2);g.rotation.y=-e.angle*Math.PI/180;scene.add(g);const isEntry=e.i===entry.i;const hasArt=items.some(i=>isArt(i.kind)&&Math.abs(((i.rotation-e.angle+540)%360)-180)<1&&Math.abs((i.x-e.a.x)*e.nx+(i.z-e.a.z)*e.nz-.16)<.05);const isRestroom=restroom?.edge===e.i;const kitchen=kitchens.find(k=>k.edge===e.i)??(isRestroom?restroom:null);const isKitchen=!!kitchen;const windowWall=(e.nx<-.8||e.nz>.8)&&e.length>3&&!isEntry&&!isKitchen;
 const frame=mat('#135f48',.4),glass=new T.MeshStandardMaterial({color:'#d9eee6',roughness:.16,metalness:.08,transparent:true,opacity:.23,depthWrite:false}),leading=mat('#263f34',.55);
 if(isEntry){
  const half=entry.width/2,w=(e.length-entry.width)/2;
  for(const side of[-1,1])if(w>0){box(w,3.3,.18,side*(half+w/2),1.65,0,wall,g);box(w,.82,.1,side*(half+w/2),.41,.1,darkwood,g);}
  box(entry.width,.6,.18,0,3,0,wall,g);
  for(const x of[-half,half])box(.10,2.7,.14,x,1.35,0,frame,g);
  for(const y of[.055,2.65])box(entry.width,.11,.14,0,y,0,frame,g);
  const leaf=half;
  for(const sign of[-1,1]){const x=sign*leaf/2;
   box(leaf-.09,2.5,.018,x,1.35,0,glass,g);
   for(const edge of[-1,1])box(.065,2.57,.10,x+edge*(leaf/2-.025),1.34,0,frame,g);
   for(const y of[.105,2.2,2.59])box(leaf-.08,y===2.2?.018:.07,.10,x,y,0,y===2.2?leading:frame,g);
   for(const edge of[-1,1]){box(.13,.25,.021,x+edge*(leaf/2-.12),2.36,.002,mat('#b42c31',.35),g);box(.018,2.43,.025,x+edge*(leaf/2-.19),1.35,0,leading,g);}
   for(const face of[-1,1]){cyl(.017,.017,.65,sign*.13,1.24,face*.10,mat('#c5c7bd',.24),g);for(const y of[.94,1.54])box(.035,.035,.10,sign*.13,y,face*.06,metal,g);}
  }
  box(entry.width+.5,.035,2.4,0,-.01,-1.2,mat('#a6a396'),g);
 }

 else if(isKitchen&&kitchen){const half=kitchen.width/2;const center=(kitchen.door.x-(e.a.x+e.b.x)/2)*e.tx+(kitchen.door.z-(e.a.z+e.b.z)/2)*e.tz;const left=center-half+e.length/2,right=e.length/2-center-half;for(const [w,cx] of [[left,-e.length/2+left/2],[right,e.length/2-right/2]])if(w>0){box(w,3.3,.18,cx,1.65,0,wall,g);box(w,.82,.1,cx,.41,.1,darkwood,g);}box(kitchen.width,1.05,.18,center,2.775,0,wall,g);for(const dx of[-half-.02,half+.02])box(.055,2.25,.2,center+dx,1.125,0,darkwood,g);box(kitchen.width+.06,.055,.2,center,2.25,0,darkwood,g);// Interior-only doorway backdrop: no black volume protrudes outside the room.
 const backdrop=new T.Mesh(new T.PlaneGeometry(kitchen.width,2.25),new T.MeshBasicMaterial({color:'#252a23',side:T.FrontSide}));backdrop.position.set(center,1.125,-.025);if(!isRestroom)g.add(backdrop);if(isRestroom){
 const doorWood=mat('#b8864f',.52,woodTex),centerWood=mat('#73563b',.53,woodTex),handle=mat('#a9b1ad',.22),dw=kitchen.width-.06,dh=2.19,gw=Math.min(.55,dw*.53),gh=.67,gy=1.55;
 // Wood door with a large glazed upper window and a central darker panel.
 for(const side of[-1,1])box((dw-gw)/2,dh,.055,center+side*(dw+gw)/4,dh/2+.025,.025,doorWood,g);
 const bottom=gy-gh/2,top=gy+gh/2;
 box(gw,bottom-.025,.055,center,(bottom+.025)/2,.025,centerWood,g);
 box(gw,dh+.025-top,.055,center,(dh+.025+top)/2,.025,doorWood,g);
 box(gw,gh,.018,center,gy,.025,new T.MeshStandardMaterial({color:'#d9eee6',roughness:.16,metalness:.08,transparent:true,opacity:.23,depthWrite:false}),g);
 for(const side of[-1,1]){box(.025,gh+.035,.025,center+side*gw/2,gy,.055,handle,g);box(gw+.02,.025,.025,center,gy+side*gh/2,.055,handle,g);}
 box(dw-.03,.15,.018,center,.10,.065,handle,g);
 const hx=center+dw*.37;box(.085,.37,.018,hx,1.0,.066,mat('#585f5b',.3),g);
 for(const y of[.86,1.14])box(.035,.035,.075,hx,y,.10,handle,g);box(.035,.30,.03,hx,1.0,.145,handle,g);
}const label=texture(c=>{c.fillStyle=isRestroom?'#f3f3e9':'#304839';c.fillRect(0,0,512,512);c.fillStyle=isRestroom?'#27675d':'#eee8ce';c.textAlign='center';if(isRestroom){c.save();c.scale(1,3.82);restroomIcons(c,100,27,100);c.fillStyle='#31504b';c.font='bold 69px sans-serif';c.fillText('WC',362,95);c.restore();}else{c.font='bold 76px sans-serif';c.fillText('KITCHEN',256,285);}});const sign=new T.Mesh(new T.PlaneGeometry(isRestroom?.65:.85,isRestroom?.17:.20),mat('#ffffff',.8,label));sign.position.set(center,isRestroom?2.04:2.45,.105);g.add(sign);}
 else if(windowWall){
  const count=Math.max(1,Math.ceil(e.length/2.5)),bay=e.length/count;
  for(let j=0;j<count;j++){
   const x=-e.length/2+bay*(j+.5),artHere=items.some(i=>isArt(i.kind)&&Math.abs((i.x-e.a.x)*e.nx+(i.z-e.a.z)*e.nz-.16)<.07&&Math.abs((i.x-(e.a.x+e.b.x)/2)*e.tx+(i.z-(e.a.z+e.b.z)/2)*e.tz-x)<(bay+CATALOG[i.kind].w)/2+.1);
   if(artHere){box(bay,3.3,.18,x,1.65,0,wall,g);box(bay,.82,.1,x,.41,.1,darkwood,g);continue;}
   box(bay,.55,.18,x,.275,0,wall,g);box(bay,.22,.18,x,3.19,0,wall,g);
   box(bay-.10,2.53,.018,x,1.815,0,glass,g);
   for(const dx of[-bay/2+.045,bay/2-.045])box(.09,2.6,.12,x+dx,1.815,0,frame,g);
   for(const y of[.57,3.08])box(bay,.08,.12,x,y,0,frame,g);
   for(const y of[1.35,1.57,2.6])box(bay-.08,.018,.025,x,y,.018,leading,g);
   for(const dx of[-bay*.27,0,bay*.27])box(.014,2.48,.025,x+dx,1.815,.018,leading,g);
   for(const side of[-1,1]){box(.14,.2,.024,x+side*(bay/2-.16),1.46,.02,mat('#b93038',.3),g);box(.14,.37,.024,x+side*(bay/2-.16),2.85,.02,mat('#258459',.3),g);}
  }
  const silhouette=new T.MeshBasicMaterial({color:'#596965',transparent:true,opacity:.30,depthWrite:false,side:T.DoubleSide});
  for(let n=0;n<(e.length>8?2:1);n++){const person=new T.Group();person.position.z=-.8;g.add(person);
   const head=new T.Mesh(new T.CircleGeometry(.105,12),silhouette);head.position.y=1.57;person.add(head);
   const body=new T.Mesh(new T.PlaneGeometry(.25,.57),silhouette);body.position.y=1.19;person.add(body);
   const legs:T.Group[]=[];for(const side of[-1,1]){const limb=new T.Group();limb.position.set(side*.06,.91,0);person.add(limb);const leg=new T.Mesh(new T.PlaneGeometry(.08,.47),silhouette);leg.position.y=-.23;limb.add(leg);legs.push(limb);}
   for(const side of[-1,1]){const arm=new T.Mesh(new T.PlaneGeometry(.065,.46),silhouette);arm.position.set(side*.145,1.19,0);arm.rotation.z=side*.13;person.add(arm);}
   outsideWalkers.push({person,legs,span:e.length,phase:n*.5,speed:n?.16:.20,edge:e});
  }
 }

 else{box(e.length,3.3,.18,0,1.65,0,wall,g);box(e.length,.82,.1,0,.41,.1,darkwood,g);for(const y of[.12,.8,.9])box(e.length,.045,.12,0,y,.14,wood,g);for(let x=-e.length/2+.4;x<e.length/2;x+=.8)box(.025,.62,.04,x,.46,.16,wood,g);}
 box(e.length,.1,.2,0,3.23,0,wood,g);
 }
 // A small recruitment notice on a solid wall near the self checkout.
 const pick=recruitmentPosterSite(items,outline,[...kitchens,...(restroom?[restroom]:[])]);
 if(pick){const poster=texture(c=>{c.fillStyle='#21825d';c.fillRect(0,0,512,512);c.fillStyle='#f5ebd5';c.fillRect(30,35,452,440);for(let y=50;y<460;y+=24)for(let x=36;x<476;x+=24){c.fillStyle=((x-36)/24+(y-50)/24)%2?'#bb3c36':'#f8e8db';c.fillRect(x,y,24,24);}c.fillStyle='#f6edda';c.beginPath();c.ellipse(256,230,195,145,0,0,Math.PI*2);c.fill();c.fillStyle='#a71f32';c.textAlign='center';c.font='bold italic 57px Georgia';c.fillText('Saizeriya',256,130);for(let n=0;n<4;n++){const x=156+n*66;c.fillStyle='#e5bc92';c.beginPath();c.arc(x,212,22,0,Math.PI*2);c.fill();c.fillStyle='#273b4c';c.fillRect(x-27,238,54,86);c.fillStyle='#f2f1e7';c.fillRect(x-5,240,10,36);}c.fillStyle='#b42d31';c.fillRect(30,365,452,45);c.fillStyle='#fff';c.font='bold 30px sans-serif';c.fillText('仲間を募集しています',256,397);c.fillStyle='#326b52';c.fillRect(30,410,452,65);c.fillStyle='#fff';c.font='24px sans-serif';c.fillText('スタッフ募集',256,450);});
   const g=new T.Group();g.position.set(pick.e.a.x+pick.e.tx*pick.t,0,pick.e.a.z+pick.e.tz*pick.t);g.rotation.y=-pick.e.angle*Math.PI/180;scene.add(g);const panel=new T.Mesh(new T.PlaneGeometry(.58,.76),mat('#ffffff',.8,poster));panel.position.set(0,1.95,.103);g.add(panel);
 }
 // White 30cm fabric squares with one off-centre fruit or vegetable.
 const fabricTextures=Array.from({length:4},(_,kind)=>texture(c=>{c.fillStyle='#eee9dd';c.fillRect(0,0,512,512);c.strokeStyle='#aaa59530';c.lineWidth=1;for(let n=0;n<512;n+=5){c.beginPath();c.moveTo(n,0);c.lineTo(n,512);c.moveTo(0,n);c.lineTo(512,n);c.stroke();}
  c.save();c.translate(kind%2?125:387,390);c.scale(.62,.62);c.rotate(kind%2?.15:-.18);c.fillStyle=['#bb3830','#e59038','#74476e','#dcbb44'][kind];c.beginPath();
  if(kind===1){c.moveTo(-65,-45);c.quadraticCurveTo(0,-65,60,-45);c.quadraticCurveTo(28,35,0,106);c.quadraticCurveTo(-38,35,-65,-45);}
  else{c.ellipse(0,0,kind===2?60:70,kind===2?88:62,0,0,Math.PI*2);}c.fill();
  c.strokeStyle='#42613b';c.lineWidth=10;c.beginPath();c.moveTo(0,-55);c.lineTo(5,-95);c.stroke();c.fillStyle='#547849';c.beginPath();c.ellipse(30,-86,30,12,-.4,0,Math.PI*2);c.fill();c.restore();}));
 const panelSide=mat('#ded8c9',.96),panelMat=fabricTextures.map(tex=>[panelSide,panelSide,panelSide,panelSide,mat('#ffffff',.94,tex),panelSide]);
 let panelIndex=0;const doorsForDecor=[...kitchens,...(restroom?[restroom]:[])];
 for(const site of fabricPanelSites(items,outline,doorsForDecor)){const g=new T.Group();g.position.set(site.e.a.x+site.e.tx*site.t,1.95,site.e.a.z+site.e.tz*site.t);g.rotation.y=-site.e.angle*Math.PI/180;scene.add(g);const board=new T.Mesh(new T.BoxGeometry(.30,.30,.035),panelMat[panelIndex++%panelMat.length]);board.position.z=.1075;g.add(board);}
 // A mirrored column uses its undecorated fourth face; ordinary columns may use any clear face.
 let pillarPanels=0;for(const pillarItem of items.filter(i=>i.kind==='pillar')){if(pillarPanels>=2)break;
  for(const face of(pillarItem.mirror?[]:[3,2,1,0])){const a=(pillarItem.rotation-face*90)*Math.PI/180,nx=-Math.sin(a),nz=Math.cos(a),x=pillarItem.x+nx*.4275,z=pillarItem.z+nz*.4275;
   const probe={x,z,w:.29,d:.12,rotation:(pillarItem.rotation-face*90+360)%360};if(!inside({x:x+nx*.15,z:z+nz*.15},outline)||items.some(i=>i.id!==pillarItem.id&&!isArt(i.kind)&&i.kind!=='robot'&&intersects(probe,bounds(i))))continue;
   const g=new T.Group();g.position.set(x,1.98,z);g.rotation.y=-a;scene.add(g);const board=new T.Mesh(new T.BoxGeometry(.30,.30,.035),panelMat[panelIndex++%panelMat.length]);g.add(board);pillarPanels++;break;
  }
 }
 // Suspended green restroom direction signs along the route from the entrance.
 if(restroom){const signTex=(direction:number)=>texture(c=>{c.fillStyle='#1d664b';c.fillRect(0,0,512,512);c.save();c.scale(1,2.88);restroomIcons(c,105,47,105);c.restore();c.fillStyle='#f8f6e9';c.beginPath();if(direction>0){c.moveTo(330,206);c.lineTo(405,206);c.lineTo(405,160);c.lineTo(475,255);c.lineTo(405,350);c.lineTo(405,304);c.lineTo(330,304);}else{c.moveTo(475,206);c.lineTo(400,206);c.lineTo(400,160);c.lineTo(330,255);c.lineTo(400,350);c.lineTo(400,304);c.lineTo(475,304);}c.closePath();c.fill();});
  const forward=signTex(1),backward=signTex(-1),positions:Point[]=[],nav=createNavigator(items,outline,spawn,{services:false}),route=nav.aisleRoute(spawn,restroom.point);
  const candidates=[.42,.60,.20,.72].map(t=>{if(route.length){const index=Math.min(route.length-1,Math.floor((route.length-1)*t));return{point:route[index],next:route[Math.min(route.length-1,index+4)]};}return{point:{x:entry.x+(restroom.door.x-entry.x)*t,z:entry.z+(restroom.door.z-entry.z)*t},next:restroom.point};});
  if(route.length)candidates.push({point:spawn,next:route[Math.min(route.length-1,4)]});
  if(!route.length)candidates.length=0;
  for(const candidate of candidates){if(positions.length>=2)break;const {x,z}=candidate.point;if(Math.hypot(x-restroom.door.x,z-restroom.door.z)<3.5||!canWalk(x,z,[],outline,.4)||positions.some(p=>Math.hypot(x-p.x,z-p.z)<3))continue;positions.push({x,z});
   const g=new T.Group(),angle=Math.atan2(-(candidate.next.z-z),candidate.next.x-x);g.position.set(x,3.27,z);g.rotation.y=-angle;scene.add(g);
   for(const xSide of[-.25,.25])rod(new T.Vector3(xSide,0,0),new T.Vector3(xSide,-.20,0),.006,metal,g);
   const front=new T.Mesh(new T.PlaneGeometry(.72,.25),new T.MeshBasicMaterial({map:forward,side:T.FrontSide}));front.position.set(0,-.32,.008);g.add(front);
   const back=new T.Mesh(new T.PlaneGeometry(.72,.25),new T.MeshBasicMaterial({map:backward,side:T.FrontSide}));back.position.set(0,-.32,-.008);back.rotation.y=Math.PI;g.add(back);
  }
 }
 const lamps:T.PointLight[]=[];
 for(let x=-12;x<=12;x+=3.8)for(let z=-13;z<=12;z+=4){if(!canWalk(x,z,[],outline,.6))continue;const rim=cyl(.14,.14,.018,x,3.278,z,mat('#e5e0d3')),lens=cyl(.105,.105,.012,x,3.265,z,new T.MeshStandardMaterial({color:'#fff7dc',emissive:'#fff0ce',emissiveIntensity:2}));rim.castShadow=lens.castShadow=false;rim.receiveShadow=lens.receiveShadow=false;const l=new T.PointLight('#ffeaca',9,7,2);l.position.set(x,3.1,z);scene.add(l);lamps.push(l);}
 // Recessed four-way air conditioners and separate extraction grilles.
 for(let x=-10;x<12;x+=5)for(let z=-10;z<12;z+=5){if(!canWalk(x,z,[],outline,.8))continue;
  const ceilingBox=(...args:Parameters<typeof box>)=>{const mesh=box(...args);mesh.castShadow=false;return mesh;};
  const housing=mat('#d7d5c9',.5),slot=mat('#373c38');
  ceilingBox(.88,.035,.88,x,3.27,z,housing);ceilingBox(.61,.018,.61,x,3.244,z,slot);
  for(let n=0;n<17;n++)ceilingBox(.57,.012,.014,x,3.23,z-.28+n*.035,housing);
  for(const d of[-1,1]){ceilingBox(.73,.012,.045,x,3.245,z+d*.37,slot);ceilingBox(.045,.012,.66,x+d*.37,3.245,z,slot);}
  if(canWalk(x+1.2,z,[],outline,.3)){ceilingBox(.32,.025,.32,x+1.2,3.27,z,housing);for(let n=0;n<9;n++)ceilingBox(.27,.01,.013,x+1.2,3.25,z-.12+n*.03,slot);}
 }
 const pendantSites:Point[]=[];
 for(const b of items.filter(i=>i.kind==='bench')){
  const a=b.rotation*Math.PI/180,c=Math.cos(a),sn=Math.sin(a);
  const joined=items.some(q=>q.id!==b.id&&q.kind==='bench'&&q.rotation===b.rotation&&Math.abs(Math.abs((q.x-b.x)*c+(q.z-b.z)*sn)-1.84)<.08&&Math.abs(-(q.x-b.x)*sn+(q.z-b.z)*c)<.08);
  const againstWall=edges(outline).some(e=>{const d=(b.x-e.a.x)*e.nx+(b.z-e.a.z)*e.nz,t=(b.x-e.a.x)*e.tx+(b.z-e.a.z)*e.tz;return Math.abs(e.nx-sn)<.05&&Math.abs(e.nz+c)<.05&&d>=.30&&d<.55&&t>=0&&t<=e.length;});
  if(!joined||!againstWall)continue;
  const x=b.x+sn*.75,z=b.z-c*.75;if(!canWalk(x,z,[],outline,.3)||pendantSites.some(p=>Math.hypot(p.x-x,p.z-z)<1.2))continue;pendantSites.push({x,z});
  cyl(.012,.012,.74,x,2.91,z,metal);const shade=cyl(.085,.18,.25,x,2.43,z,new T.MeshStandardMaterial({color:'#fff8e4',emissive:'#ffe9c5',emissiveIntensity:.5}));shade.castShadow=false;
 }
 const hemi=new T.HemisphereLight('#e9f2e8','#927455',2);scene.add(hemi);const sun=new T.DirectionalLight('#fff1cb',3.4);sun.position.set(7,6,3);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.1,far:30});sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;scene.add(sun);
 function tableBody(x:number,z:number,w:number,d:number,parent:T.Object3D){box(w,.039,d,x,.7565,z,darkwood,parent,.015);box(w-.018,.021,d-.018,x,.786,z,top,parent,.01);cyl(.028,.033,.64,x,.35,z,metal,parent);box(w*.65,.055,.46,x,.045,z,metal,parent,.02);}
 function table(x:number,z:number,w:number,d:number,parent:T.Object3D=scene){tableBody(x,z,w,d,parent);props(x,z,w,parent);const meal=createTableMeal(meals.length,w);meal.userData.served=true;meal.userData.width=w;meal.userData.tableId=activeTableId;mealByTable.set(activeTableId,meal);const side=rackSide(items.find(i=>i.id===activeTableId)!,items,outline);meal.position.set(x-side*.115,.8,z);meal.scale.set((w-.25)/w,1,.9);meal.visible=options.foodEnabled!==false;parent.add(meal);meals.push(meal);textures.push(...meal.userData.textures); }
 const menuTex=new T.TextureLoader().load(menuCover);menuTex.colorSpace=T.SRGBColorSpace;menuTex.anisotropy=renderer.capabilities.getMaxAnisotropy();textures.push(menuTex);const menuMaterial=new T.MeshStandardMaterial({map:menuTex,roughness:.65});

 const organizer=mat('#c9bd93',.68),tray=mat('#827b64',.65),steel=new T.MeshStandardMaterial({color:'#a4a6a0',metalness:.72,roughness:.32});
 function props(x:number,z:number,w:number,p:T.Object3D){
  const book=new T.Group();book.position.set(x,.8,z+.035);book.rotation.y=-.06;book.visible=options.foodEnabled===false;flatMenus.push(book);p.add(book);box(.182,.006,.332,0,0,0,cream,book,.002);const cover=new T.Mesh(new T.PlaneGeometry(.182,.332),menuMaterial);cover.rotation.x=-Math.PI/2;cover.position.y=.0035;cover.receiveShadow=true;book.add(cover);
  const item=items.find(i=>i.id===activeTableId)!;if(item.kind!=='serviceTable'&&!rackOwner(item,items))return;
  const rack=new T.Group();const side=item.kind==='serviceTable'?1:rackSide(item,items,outline);rack.position.set(x+side*(w/2-.057),.8,z);rack.rotation.y=-side*Math.PI/2;rack.scale.z=.6;p.add(rack);
  box(.32,.008,.19,0,.004,0,organizer,rack,.004);
  // Slim case walls and four individually recessed pull-out drawers.
  for(const xx of[-.065,.148])box(.007,.215,.145,xx,.113,0,organizer,rack,.003);
  box(.22,.01,.15,.042,.225,0,organizer,rack,.003);
  for(let n=0;n<4;n++){const yy=.018+n*.05;box(.207,.006,.143,.042,yy,0,organizer,rack,.002);box(.192,.033,.126,.042,yy+.021,-.005,tray,rack,.002);box(.195,.012,.008,.042,yy+.011,.067,organizer,rack,.002);box(.035,.006,.018,-.043,yy+.008,.079,organizer,rack,.002);for(let f=0;f<3;f++){rod(new T.Vector3(-.025,yy+.039,-.045+f*.026),new T.Vector3(.09,yy+.039,-.045+f*.026),.002,steel,rack);}}
  box(.08,.15,.105,-.112,.13,-.013,organizer,rack,.004);for(let n=0;n<5;n++)box(.067,.001,.085,-.112,.208+n*.0015,-.014,cream,rack,.001);
  cyl(.032,.035,.012,-.112,.019,.061,cream,rack);cyl(.012,.016,.006,-.112,.028,.061,steel,rack);
  box(.31,.205,.006,0,.15,-.092,organizer,rack,.003);box(.31,.08,.006,0,.25,-.066,organizer,rack,.003);
  const upright=new T.Group();upright.position.set(.02,.27,-.076);upright.rotation.x=-.035;rack.add(upright);box(.18,.32,.005,0,.04,0,cream,upright,.002);const menu=new T.Mesh(new T.PlaneGeometry(.18,.32),menuMaterial);menu.position.set(0,.04,.003);upright.add(menu);
 }
 const cane=mat('#d7aa65',.36,woodTex),binding=mat('#29251e',.48),plastic=mat('#85837d',.48);
 const wickerTex=texture(c=>{c.fillStyle='#393124';c.fillRect(0,0,512,512);for(let x=0;x<512;x+=16){c.fillStyle='#c7a760';c.fillRect(x+1,0,13,512);c.fillStyle='#e2c27c';c.fillRect(x+3,0,3,512);for(let y=(x/16%2)*12;y<512;y+=24){c.fillStyle='#3a3024';c.fillRect(x+1,y,13,5);}}});
 const wicker=mat('#ffffff',.6,wickerTex);wicker.side=T.DoubleSide;
 const diamondTex=texture(c=>{c.fillStyle='#b28d56';c.fillRect(0,0,512,512);c.lineJoin='round';for(let r=350;r>2;r-=10){c.beginPath();c.moveTo(256,256-r);c.lineTo(256+r,256);c.lineTo(256,256+r);c.lineTo(256-r,256);c.closePath();c.strokeStyle=r%20?'#6d4c30':'#e1c38c';c.lineWidth=5;c.stroke();}});
 const diamondWicker=mat('#ffffff',.72,diamondTex);diamondWicker.side=T.DoubleSide;
 const stripeTex=texture(c=>{c.fillStyle='#abb17a';c.fillRect(0,0,512,512);for(let x=0;x<512;x+=16){c.fillStyle='#c5c893';c.fillRect(x,0,3,512);c.fillStyle='#909969';c.fillRect(x+6,0,2,512);c.fillStyle='#b6bb84';c.fillRect(x+10,0,4,512);}});
 const backFabric=mat('#ffffff',.78,stripeTex);
 const holes=texture(c=>{c.fillStyle='white';c.fillRect(0,0,512,512);c.fillStyle='black';for(let y=8;y<512;y+=14)for(let x=8+(Math.floor(y/14)%2)*7;x<512;x+=14){c.beginPath();c.arc(x,y,4.1,0,Math.PI*2);c.fill();}});holes.colorSpace=T.NoColorSpace;
 const perforated=new T.MeshStandardMaterial({color:'#85837d',roughness:.48,alphaMap:holes,alphaTest:.5,side:T.DoubleSide});
 function chair(x:number,z:number,rotation:number,parent:T.Object3D=scene){
  const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rotation;g.userData.seat="chair";parent.add(g);
  if(options.chairStyle==='gray'||options.chairStyle==='perforated'){
   for(const a of[-1,1])for(const b of[-1,1]){const low=new T.Vector3(a*.211,.025,b*.214),high=new T.Vector3(a*.185,.45,b*.17),d=high.clone().sub(low);const leg=new T.Mesh(new T.CylinderGeometry(.027,.017,d.length(),4),plastic);leg.geometry.rotateY(Math.PI/4);leg.position.copy(low).add(high).multiplyScalar(.5);leg.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());leg.castShadow=true;g.add(leg);}
   box(.44,.035,.43,0,.453,0,plastic,g,.016);
   const seat=new T.PlaneGeometry(.425,.415,18,18),sp=seat.attributes.position;
   for(let i=0;i<sp.count;i++){const xx=sp.getX(i),zz=sp.getY(i);sp.setXYZ(i,xx,.469+.012*Math.pow(xx/.212,2)+.007*Math.pow(zz/.207,2),zz);}seat.computeVertexNormals();const sm=new T.Mesh(seat,plastic);sm.material.side=T.DoubleSide;sm.receiveShadow=true;g.add(sm);
   const back=new T.Group();back.position.set(0,.47,.175);back.rotation.x=.13;g.add(back);
   for(const a of[-1,1])box(.035,.39,.03,a*.205,.185,0,plastic,back,.012);
   box(.43,.035,.034,0,.375,0,plastic,back,.014);
   if(options.chairStyle==='perforated'){
    const geo=new T.PlaneGeometry(.38,.255,24,16),pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){const xx=pos.getX(i);pos.setZ(i,.025*(1-Math.pow(xx/.19,2)));}geo.computeVertexNormals();const panel=new T.Mesh(geo,perforated);panel.position.y=.23;panel.castShadow=true;back.add(panel);
    box(.39,.021,.026,0,.102,0,plastic,back,.009);
   }else{
    box(.158,.29,.026,0,.14,.009,plastic,back,.013);
    for(const a of[-1,1])box(.024,.085,.028,a*.068,.323,.006,plastic,back,.008);
    box(.055,.043,.03,0,.291,.01,plastic,back,.009);box(.044,.016,.05,0,.315,.018,plastic,back,.007);
   }return;
  }
  for(const a of[-1,1])for(const b of[-1,1])rod(new T.Vector3(a*.21,.025,b*.21),new T.Vector3(a*.18,.45,b*.17),.02,cane,g);
  box(.435,.045,.43,0,.448,0,cane,g,.02);box(.42,.037,.41,0,.483,-.005,green,g,.017);
  const back=new T.Group();back.position.set(0,.52,.175);back.rotation.x=.10;g.add(back);
  tube([new T.Vector3(-.19,-.06,0),new T.Vector3(-.226,.17,0),new T.Vector3(-.20,.37,0),new T.Vector3(0,.49,0),new T.Vector3(.20,.37,0),new T.Vector3(.226,.17,0),new T.Vector3(.19,-.06,0)],.021,cane,back);
  const s=new T.Shape();s.moveTo(0,.458);s.bezierCurveTo(.04,.458,.20,.29,.20,.245);s.bezierCurveTo(.20,.20,.04,.025,0,.025);s.bezierCurveTo(-.04,.025,-.20,.20,-.20,.245);s.bezierCurveTo(-.20,.29,-.04,.458,0,.458);
  const geo=new T.ShapeGeometry(s,24),uv=geo.attributes.uv,pos=geo.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)+.2)/.4,(pos.getY(i)-.025)/.433);
  const panel=new T.Mesh(geo,options.chairStyle==='wovenDiamond'?diamondWicker:wicker);panel.castShadow=true;back.add(panel);tube(s.getPoints(64).map(v=>new T.Vector3(v.x,v.y,0)),.004,binding,back);
  for(const a of[-1,1]){tube([new T.Vector3(a*.18,.015,0),new T.Vector3(a*.075,-.005,0),new T.Vector3(0,-.075,0)],.012,cane,back);rod(new T.Vector3(a*.19,.22,-.18),new T.Vector3(a*.19,.22,.18),.012,cane,g);for(const y of[.07,.09])cyl(.023,.023,.009,a*.208,y,0,binding,back);}
  for(const x of[-.044,-.022,0,.022,.044]){const band=new T.Mesh(new T.TorusGeometry(.022,.0025,6,16),binding);band.rotation.y=Math.PI/2;band.position.set(x,.49-Math.abs(x)*.12,0);back.add(band);}
 }
 function bench(x:number,z:number,rot:number,parent:T.Object3D=scene,railed=false,screen=false,length=1.84){
  const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rot;g.userData.seat='bench';g.userData.seatHalfWidth=length/2-.22;parent.add(g);
  box(length-.12,.35,.58,0,.22,-.02,darkwood,g,.018);box(length-.08,.015,.58,0,.452,-.025,piping,g,.005);
  box(length-.02,1.1,.035,0,.59,.3125,wood,g,.009);box(length-.09,.05,.56,0,.48,-.035,green,g,.016);
  box(length-.12,.30,.045,0,.75,.2725,backFabric,g,.012);box(length-.12,.19,.045,0,1.005,.2725,backFabric,g,.012);
  box(length-.02,.03,.06,0,1.15,.3,wood,g,.008);
  if(railed){if(screen)privacyScreen(g,length,.30,1.17);else handrail(g,length,.30,1.26);}return g;
 }

 // The same item coordinates and rotations drive the 2D plan and the 3D furniture.

 // A single 36 mm board with rounded top corners, without decorative infill.
 // A single static environment shared by all mirror panels; no reflection render passes.
 let pillarMirror:T.MeshStandardMaterial|undefined;
 function pillar(g:T.Object3D,mirrored:boolean){
  box(.82,3.3,.82,0,1.65,0,wall,g);
  box(.824,.82,.824,0,.41,0,darkwood,g);
  if(!mirrored)return;
  if(!pillarMirror){
   const faces=Array.from({length:6},(_,face)=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d')!;
    const gradient=c.createLinearGradient(0,0,0,64);gradient.addColorStop(0,'#eee5d1');gradient.addColorStop(.4,'#cfc8ad');gradient.addColorStop(.55,'#839782');gradient.addColorStop(.7,'#b79568');gradient.addColorStop(1,'#d9c7a8');c.fillStyle=gradient;c.fillRect(0,0,64,64);
    if(face<4){c.fillStyle='#f1eddc';c.fillRect(8,7,3,33);c.fillStyle='#b7b19a';c.fillRect(39,6,7,39);}return canvas;});
   const env=new T.CubeTexture(faces);env.colorSpace=T.SRGBColorSpace;env.needsUpdate=true;textures.push(env);
   pillarMirror=new T.MeshStandardMaterial({color:'#c4cfca',metalness:.92,roughness:.16,envMap:env,envMapIntensity:.85});
  }
  // Three decorated faces; the fourth retains the same plaster as the walls.
  for(let face=0;face<4;face++){
   const panel=new T.Group();panel.rotation.y=face*Math.PI/2;g.add(panel);
   for(const x of[-.255,.255])box(.31,2.32,.008,x,2.05,.415,pillarMirror,panel);
   const tileAccent=mat(face%2?'#245d45':'#b42635',.28),pitch=.2/3;
   for(let row=0;row<35;row++)for(let col=0;col<3;col++)box(pitch-.004,pitch-.004,.009,(col-1)*pitch,.90+pitch/2+row*pitch,.419,(row+col)%2?tileAccent:cream,panel);
   for(const x of[-.407,-.103,.103,.407])box(.008,2.32,.013,x,2.05,.425,steel,panel);
   rod(new T.Vector3(0,2.56,.43),new T.Vector3(0,2.56,.61),.018,steel,panel);
   const shade=cyl(.055,.12,.19,0,2.46,.61,new T.MeshStandardMaterial({color:'#fff8e7',emissive:'#fff1da',emissiveIntensity:.65}),panel);shade.castShadow=false;
  }
 }
 const screenTex=texture(c=>{c.fillStyle='#e6e6d8';c.fillRect(0,0,512,512);c.fillStyle='#aebbb0';for(let y=0;y<512;y+=32)for(let x=0;x<512;x+=32){c.beginPath();c.moveTo(x+16,y+6);c.lineTo(x+26,y+16);c.lineTo(x+16,y+26);c.lineTo(x+6,y+16);c.fill();}});
 function privacyScreen(g:T.Object3D,length:number,z:number,bottom:number){
  box(length-.08,.36,.018,0,bottom+.18,z,mat('#ffffff',.5,screenTex),g);
  for(const x of[-length/2+.025,length/2-.025])box(.025,.40,.028,x,bottom+.19,z,steel,g);
  for(const y of[bottom,bottom+.38])box(length,.023,.03,0,y,z,steel,g);
 }
 function handrail(g:T.Object3D,length:number,z:number,y:number){
  for(const x of[-length/2+.18,length/2-.18]){cyl(.012,.012,.13,x,y-.075,z,steel,g);box(.06,.018,.055,x,y-.135,z,steel,g);}
  rod(new T.Vector3(-length/2+.015,y,z),new T.Vector3(length/2-.015,y,z),.028,wood,g);
 }
 function dividerWall(parent:T.Object3D,item:Item,railed:boolean){
  const span=dividerSpan(item,items),g=new T.Group();g.position.x=span.offset;parent.add(g);
  box(span.width,1.14,.16,0,.57,0,wall,g);box(span.width,.045,.16,0,1.16,0,wood,g);
  if(railed){if(item.screen)privacyScreen(g,span.width,0,1.185);else handrail(g,span.width,0,1.31);}
 }
 function partition(g:T.Object3D,height=1.25){const shape=new T.Shape();shape.moveTo(-.9,0);shape.lineTo(.9,0);shape.lineTo(.9,height-.06);shape.quadraticCurveTo(.9,height,.84,height);shape.lineTo(-.84,height);shape.quadraticCurveTo(-.9,height,-.9,height-.06);shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:.032,bevelEnabled:true,bevelThickness:.002,bevelSize:.002,bevelSegments:2,steps:1,curveSegments:12});geo.translate(0,0,-.016);const panel=new T.Mesh(geo,wood);panel.castShadow=true;panel.receiveShadow=true;g.add(panel);}
 const leafMaterials=['#36592f','#456d36','#527d3b','#63874a'].map(color=>new T.MeshStandardMaterial({color,roughness:.62,side:T.DoubleSide}));
 const stemMaterial=mat('#686044',.9),veinMaterial=mat('#849455',.8);
 function plant(g:T.Object3D){
  const pot=new T.Mesh(new T.LatheGeometry([new T.Vector2(.15,0),new T.Vector2(.205,.355),new T.Vector2(.208,.375),new T.Vector2(.19,.375),new T.Vector2(.181,.345)],40),mat('#a57957',.85));pot.castShadow=true;pot.receiveShadow=true;g.add(pot);cyl(.181,.181,.008,0,.347,0,mat('#3d3024',1),g);
  for(let j=0;j<5;j++){
   const theta=j*2.399,height=.72+rand()*.4,stemX=Math.cos(theta)*.075,stemZ=Math.sin(theta)*.075;
   tube([new T.Vector3(0,.37,0),new T.Vector3(stemX*.6,height*.75,stemZ*.6),new T.Vector3(stemX,height,stemZ)],.005,stemMaterial,g);
   for(let k=0;k<5;k++){
    const angle=theta+k*2.35,length=.16+rand()*.065,y=.48+(height-.48)*k/4;
    const base=new T.Vector3(stemX*y/height,y,stemZ*y/height),tip=base.clone().add(new T.Vector3(Math.cos(angle)*.07,.028,Math.sin(angle)*.07));rod(base,tip,.0025,stemMaterial,g);
    const leafGroup=new T.Group();leafGroup.position.copy(tip);leafGroup.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(Math.cos(angle),.25+rand()*.65,Math.sin(angle)).normalize());g.add(leafGroup);
    const vertices:number[]=[],uvs:number[]=[],indices:number[]=[];
    for(let row=0;row<=12;row++){const t=row/12,width=.045*Math.pow(Math.sin(Math.PI*t),.8);for(let col=0;col<=4;col++){const u=col/2-1;vertices.push(u*width,t*length,.024*Math.sin(Math.PI*t)-.012*u*u*Math.sin(Math.PI*t));uvs.push(col/4,t);if(row<12&&col<4){const n=row*5+col;indices.push(n,n+1,n+5,n+1,n+6,n+5);}}}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();const leaf=new T.Mesh(geometry,leafMaterials[(j+k)%4]);leaf.castShadow=true;leaf.receiveShadow=true;leafGroup.add(leaf);
    tube([new T.Vector3(0,0,.001),new T.Vector3(0,length*.5,.025),new T.Vector3(0,length,.001)],.0008,veinMaterial,leafGroup);
   }
  }
 }
 // A few ceramic wall planters with slender stems and individual pointed leaves.
 const wallPot=mat('#f0eee5',.55),wallStem=mat('#46673d',.85),wallLeaves=['#315d35','#3d7140','#547c46'].map(color=>{const m=mat(color,.82);m.side=T.DoubleSide;return m;});
 const leafShape=new T.Shape();leafShape.moveTo(0,0);leafShape.quadraticCurveTo(.9,.20,.9,.48);leafShape.quadraticCurveTo(.65,.82,0,1);leafShape.quadraticCurveTo(-.65,.82,-.9,.48);leafShape.quadraticCurveTo(-.9,.20,0,0);
 const leafGeometry=new T.ShapeGeometry(leafShape,8);
 for(const site of wallPlanterSites(items,outline,[...kitchens,...(restroom?[restroom]:[])])){
  const g=new T.Group();g.position.set(site.e.a.x+site.e.tx*site.t,1.88,site.e.a.z+site.e.tz*site.t);g.rotation.y=-site.e.angle*Math.PI/180;scene.add(g);
  const pot=cyl(.15,.065,.16,0,0,.16,wallPot,g);pot.scale.z=.65;pot.castShadow=false;
  const lip=cyl(.157,.157,.018,0,.085,.16,wallPot,g);lip.scale.z=.65;lip.castShadow=false;
  for(let k=0;k<5;k++){const a=(k-2)*.43;rod(new T.Vector3(0,.085,.16),new T.Vector3(Math.sin(a)*.11,.24-Math.abs(k-2)*.012,.16+Math.cos(a)*.015),.0025,wallStem,g);}
  for(let color=0;color<3;color++){const foliage=new T.InstancedMesh(leafGeometry,wallLeaves[color],6),leaf=new T.Object3D();
   for(let j=0;j<6;j++){const n=color*6+j,a=(n%6-2.5)*.45,layer=Math.floor(n/6);leaf.position.set(Math.sin(a)*(.045+layer*.017),.105+layer*.035,.16+.012*(n%3));leaf.rotation.set((n%3-1)*.32,(n%4-1.5)*.25,-a);leaf.scale.set(.024+(n%2)*.005,.075+(n%3)*.012,1);leaf.updateMatrix();foliage.setMatrixAt(j,leaf.matrix);}
   foliage.instanceMatrix.needsUpdate=true;g.add(foliage);
  }
 }
 let audioContext:AudioContext|null=null,gain:GainNode|null=null,osc:OscillatorNode|null=null,soundEnabled=false;const audioLast=new Map<string,Point>();
 function sound(enabled:boolean){soundEnabled=enabled;if(enabled){audioContext??=new AudioContext();if(!osc){gain=audioContext.createGain();gain.gain.value=0;osc=audioContext.createOscillator();osc.type='triangle';osc.frequency.value=95;osc.connect(gain);gain.connect(audioContext.destination);osc.start();}void audioContext.resume().catch(()=>{});}else if(gain&&audioContext)gain.gain.setTargetAtTime(0,audioContext.currentTime,.05);}
 const robotMeshes=new Map<string,T.Group>();let robotPaused=false;
 function artwork(item:Item,g:T.Group){const art=ARTWORKS[item.kind as keyof typeof ARTWORKS],w=CATALOG[item.kind].w,h=w/art.ratio;const logo=item.kind==='logo';if(logo&&item.logoStyle==='letters'){
 const lettering=texture(c=>{c.clearRect(0,0,1024,1024);c.textAlign='center';c.shadowColor='#433c32';c.shadowOffsetX=4;c.shadowOffsetY=6;c.fillStyle='#dadbd1';c.font='bold italic 180px Georgia';c.fillText('Saizeriya',512,510);c.shadowOffsetX=c.shadowOffsetY=0;c.fillStyle='#146c4c';c.fillRect(80,535,864,12);c.fillStyle='#ae3133';c.font='40px sans-serif';c.fillText('RISTORANTE E CAFFÈ',512,610);},1024);
 const sign=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map:lettering,transparent:true,alphaTest:.1,roughness:.38,side:T.DoubleSide}));sign.position.set(0,2.05,-.04);g.add(sign);return;
}if(!logo){const ivory=mat('#d8d5c9',.48);for(const side of[-1,1]){box(w+.14,.07,.018,0,2.05+side*(h/2+.035),-.052,ivory,g);box(.07,h,.018,side*(w/2+.035),2.05,-.052,ivory,g);box(w+.08,.01,.003,0,2.05+side*(h/2+.035),-.041,steel,g);box(.01,h+.06,.003,side*(w/2+.035),2.05,-.041,steel,g);}}const tex=new T.TextureLoader().load(art.src,loaded=>{if(logo&&item.logoStyle==='mono'){const canvas=document.createElement('canvas');canvas.width=loaded.image.width;canvas.height=loaded.image.height;const c=canvas.getContext('2d')!;c.drawImage(loaded.image,0,0);const data=c.getImageData(0,0,canvas.width,canvas.height);for(let n=0;n<data.data.length;n+=4){const v=.2126*data.data[n]+.7152*data.data[n+1]+.0722*data.data[n+2];data.data[n]=v*.62+55;data.data[n+1]=v*.62+58;data.data[n+2]=v*.62+51;}c.putImageData(data,0,0);const mono=new Image();mono.onload=()=>{loaded.image=mono;loaded.needsUpdate=true;};mono.src=canvas.toDataURL();}});tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=renderer.capabilities.getMaxAnisotropy();textures.push(tex);const picture=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map:tex,roughness:.8,transparent:logo,alphaTest:logo?.1:0,side:logo?T.DoubleSide:T.FrontSide}));picture.position.set(0,2.05,logo?-.065:-.046);g.add(picture);}
 function servi(g:T.Group){const white=mat('#efeee7',.4),black=mat('#242827',.5);cyl(.225,.23,.16,0,.12,0,black,g);cyl(.215,.22,.17,0,.25,0,white,g);box(.18,.61,.1,0,.63,.155,white,g,.04);for(const y of[.37,.7,1.025]){cyl(y===.37?.184:.2,y===.37?.172:.2,.035,0,y,0,black,g);cyl(.2,.18,.028,0,y-.028,0,white,g);}cyl(.217,.217,.025,0,.19,0,black,g);box(.11,.09,.045,0,.95,.19,black,g,.012);const screen=box(.085,.055,.006,0,.955,.163,mat('#75b8af',.25),g,.008);screen.rotation.x=-.2;for(const x of[-.16,.16])cyl(.034,.034,.02,x,.073,0,black,g);}
 function staffSink(g:T.Group){
  const ceramic=mat('#e6e9e2',.3),inside=mat('#d4ded7',.34),tap=mat('#a6b3ac',.22),soap=mat('#67b7a0',.4);
  box(.52,.65,.35,0,.33,0,ceramic,g,.025);box(.57,.14,.41,0,.72,0,ceramic,g,.045);
  box(.43,.014,.27,0,.798,.025,inside,g,.025);cyl(.025,.025,.008,0,.809,.08,tap,g);
  box(.57,.14,.07,0,.83,-.17,ceramic,g,.025);rod(new T.Vector3(.04,.86,-.15),new T.Vector3(.04,.86,-.02),.019,tap,g);
  cyl(.036,.036,.12,-.17,.91,-.12,soap,g);cyl(.037,.037,.018,-.17,.977,-.12,ceramic,g);
  box(.32,.18,.10,0,1.25,-.18,tap,g,.012);box(.27,.10,.005,0,1.25,-.123,ceramic,g);
  const label=texture(c=>{c.fillStyle='#f6f6ef';c.fillRect(0,0,512,512);c.fillStyle='#202722';c.textAlign='center';c.font='bold 104px sans-serif';c.fillText('従業員専用',256,295);});const note=new T.Mesh(new T.PlaneGeometry(.27,.10),mat('#ffffff',.8,label));note.position.set(0,1.25,-.119);g.add(note);
 }
 function serviceTable(g:T.Group){
  tableBody(0,0,.82,.78,g);
  // Three side-by-side menu cases along the back, visible with meals off.
  for(const x of[-.25,0,.25]){const group=new T.Group();g.add(group);props(0,0,.82,group);const book=flatMenus.pop();book?.removeFromParent();const rack=group.children[0];rack.position.set(x,.8,-.27);rack.rotation.y=0;rack.scale.set(.7,.85,.6);}
  for(const x of[-.25,0,.25]){const plates=createTableMeal(0,.4,'plates');plates.scale.setScalar(.8);plates.position.set(x,.8,.22);g.add(plates);}
  for(let n=0;n<6;n++){const x=-.29+n*.115,z=-.015,h=[.21,.17,.13][n%3],color=['#575526','#bd3925','#9b825f'][n%3];cyl(.028,.031,h,x,.8+h/2,z,mat(color,.35),g);cyl(.024,.024,.03,x,.8+h+.015,z,plastic,g);box(.04,.06,.002,x,.8+h*.48,z+.031,cream,g,.001);}

 }
 function drinkbar(g:T.Group){
  const steel=mat('#b7bfbb',.28),black=mat('#292e2b',.35),white=mat('#eeeade',.35);
  box(3.2,.85,.85,0,.425,0,wood,g,.025);box(3.2,.055,.85,0,.875,0,mat('#21564b',.3),g,.01);
  const backdrop=texture(c=>{
   const tile=options.drinkbarStyle==='tile';
   if(tile){
    c.scale(320,512);c.fillStyle='#dad7c6';c.fillRect(0,0,3.2,2);
    const square=(x:number,y:number,color:string)=>{c.fillStyle=color;c.fillRect(x+.003,y+.003,.094,.094);c.strokeStyle='#ffffff65';c.lineWidth=.002;c.strokeRect(x+.007,y+.007,.086,.086);};
    for(let y=0;y<2;y+=.1)for(let x=0;x<3.2;x+=.1){const accent=(Math.abs(x-.45)<.2||Math.abs(x-2.65)<.2)&&y>.8&&y<1.3;square(x,y,accent?((Math.round(x*10)+Math.round(y*10))%2?'#285f47':'#b42f31'):'#f2f0de');}
    c.save();c.beginPath();c.moveTo(1.6,.35);c.lineTo(2.42,1.17);c.lineTo(1.6,1.99);c.lineTo(.78,1.17);c.closePath();c.clip();c.translate(1.6,1.17);c.rotate(Math.PI/4);c.fillStyle='#d1d1bc';c.fillRect(-1,-1,2,2);
    for(let y=-1;y<1;y+=.1)for(let x=-1;x<1;x+=.1)square(x,y,'#f4f1df');
    // Fixed diamond: red upper/lower tips, green lateral wings.
    const motif=['RRGG','RRGG','GGRR','GGRR'];
    for(let row=0;row<4;row++)for(let col=0;col<4;col++)square((col-2)*.1,(row-2)*.1,motif[row][col]==='R'?'#cf162c':'#285f47');c.restore();c.setTransform(1,0,0,1,0,0);
   }else{
    c.fillStyle='#b58750';c.fillRect(0,0,1024,1024);
    for(let row=0;row<7;row++){let x=-((row%2)*95);while(x<1024){const w=180+rand()*170,y=row*147;c.fillStyle=['#966a43','#c19056','#a57b4b','#765038'][Math.floor(rand()*4)];c.fillRect(x+3,y+3,w-6,141);for(let n=0;n<55;n++){c.fillStyle=rand()>.5?'#ffffff18':'#2717071c';c.fillRect(x+5,y+rand()*140,w-10,1+rand()*2);}x+=w;}}
   }
   c.textAlign='center';c.shadowColor='#3c301b';c.shadowBlur=5;c.shadowOffsetX=3;c.shadowOffsetY=4;c.fillStyle='#fff5d8';c.font='bold 94px Georgia';c.fillText(tile?'Drink Bar':'DRINK BAR',512,310);
  },1024);
  box(3.2,2,.035,0,1.9,-.4,mat('#ffffff',.65,backdrop),g,.003);
  // Compact bank in the existing 3.2m footprint: two dispensers, water,
  // three columns of cup baskets, then two distinct hot-drink appliances.
  const face=(tex:T.Texture,w:number,h:number,x:number,y:number,z:number)=>{const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map:tex,roughness:.4,emissive:'#ffffff',emissiveMap:tex,emissiveIntensity:.18}));m.position.set(x,y,z);g.add(m);};
  const drinks=texture(c=>{c.fillStyle='#e8ebdd';c.fillRect(0,0,512,512);const colors=['#a81c2c','#ef983a','#93bc52','#793b86','#d46d94','#65afca'];for(let n=0;n<6;n++){const x=(n%2)*256,y=Math.floor(n/2)*170;c.fillStyle=colors[n];c.fillRect(x+6,y+5,244,160);c.fillStyle='#ffffff';c.textAlign='center';c.font='bold 25px sans-serif';c.fillText(['COLA','ORANGE','MELON','GRAPE','PEACH','SODA'][n],x+128,y+90);}});
  for(const x of[-1.31,-.79]){box(.49,.83,.49,x,1.315,-.08,white,g,.015);face(drinks,.43,.59,x,1.40,.169);box(.47,.035,.24,x,.935,.20,black,g);for(let n=0;n<3;n++){cyl(.018,.018,.06,x-.14+n*.14,1.07,.20,black,g);box(.045,.014,.07,x-.14+n*.14,1.035,.22,steel,g);}}
  // Water tap and lidded ice bin.
  box(.30,.22,.38,-.36,1.01,.06,steel,g);box(.28,.012,.34,-.36,1.127,.06,steel,g);rod(new T.Vector3(-.36,1.13,-.10),new T.Vector3(-.36,1.35,-.10),.018,steel,g);rod(new T.Vector3(-.36,1.35,-.10),new T.Vector3(-.36,1.35,.05),.018,steel,g);
  const basket=mat('#d9ceae',.6),cups=mat('#edf0e4',.32);
  for(let col=0;col<3;col++){const x=-.08+col*.27;
   // Open storage replaces the cabinet front in this section.
   box(.26,.76,.012,x,.47,.434,black,g);
   for(const side of[-1,1])box(.012,1.46,.45,x+side*.13,.83,.04,steel,g);
   for(let row=0;row<6;row++){const y=.19+row*.235;box(.25,.012,.42,x,y,.04,steel,g);for(const side of[-1,1])box(.012,.11,.35,x+side*.116,y+.07,.04,basket,g);box(.24,.035,.014,x,y+.105,.218,basket,g);box(.24,.025,.014,x,y+.035,.218,basket,g);for(const dx of[-.07,.07])box(.014,.07,.014,x+dx,y+.07,.218,basket,g);for(const dx of[-.065,.065])for(const z of[-.06,.09])cyl(.035,.028,.09,x+dx,y+.06,z,row===0?mat('#d8bb34'):cups,g);}
  }
  // Tea sachets above the rack, arranged in two tiers of three.
  box(.68,.025,.38,.19,1.64,-.02,steel,g);for(let row=0;row<2;row++)for(let col=0;col<3;col++)box(.16,.13,.025,-.02+col*.20,1.73+row*.16,-.11,mat(['#b6434c','#db9e49','#538b69','#8a5e90','#599da0','#5d8ab9'][row*3+col]),g);
  for(const x of[.87,1.34]){box(.43,.78,.47,x,1.295,-.08,black,g,.015);box(.43,.035,.26,x,.93,.19,steel,g);}
  // Narrow warming unit alongside the coffee machine with bean hopper.
  box(.37,.20,.012,.87,1.55,.162,steel,g);for(let n=0;n<6;n++)box(.29,.008,.008,.87,1.48+n*.025,.173,black,g);box(.24,.025,.035,.87,1.12,.18,cream,g);
  box(.34,.23,.022,1.34,1.48,.17,mat('#396c88',.25),g);for(let n=0;n<6;n++)box(.065,.035,.006,1.24+(n%3)*.10,1.43+Math.floor(n/3)*.09,.185,cream,g);box(.11,.17,.10,1.34,1.18,.20,black,g);cyl(.13,.11,.20,1.34,1.79,-.08,mat('#584334',.35),g);
  for(let n=0;n<4;n++)box(.11,.04,.08,.63,1.0+n*.13,.10,organizer,g);

 }
 function checkout(g:T.Group){
  const ivory=mat('#e7e3d2',.35),black=mat('#222726',.3),counter=mat('#355b4a',.42);
  box(1.3,.86,.7,0,.43,0,wood,g,.025);box(1.34,.045,.74,0,.88,0,counter,g,.015);
  box(.78,.29,.48,-.03,1.045,.055,ivory,g,.025);box(.48,.045,.16,0,1.21,-.1,black,g,.015);
  box(.62,.55,.055,.05,1.49,-.12,black,g,.025);
  const screen=texture(c=>{c.fillStyle='#e6f3f1';c.fillRect(0,0,512,512);c.fillStyle='#169e83';c.fillRect(0,0,512,110);c.fillStyle='white';c.textAlign='center';c.font='bold 24px sans-serif';c.fillText('バーコードをかざしてください',256,65);for(const x of[145,365]){c.fillStyle='#343c42';c.fillRect(x-48,200,96,150);c.fillStyle='#b32420';c.fillRect(x-30,220,60,75);c.fillStyle='#eff5f1';c.fillRect(x-20,330,72,100);c.fillStyle='#202a28';for(let n=0;n<13;n++)c.fillRect(x-15+n*4,350,2,45);}c.fillStyle='#43534b';c.font='25px sans-serif';c.fillText('伝票用紙         スマホ画面',256,162);});
  const panel=new T.Mesh(new T.PlaneGeometry(.55,.46),mat('#ffffff',.5,screen));panel.position.set(.05,1.49,-.087);g.add(panel);
  const label=texture(c=>{c.fillStyle='#252322';c.fillRect(0,0,512,512);c.fillStyle='#fff7dc';c.textAlign='center';c.font='bold 86px sans-serif';c.fillText('セルフレジ',256,250);c.font='38px sans-serif';c.fillText('Self Checkout',256,325);});const sign=new T.Mesh(new T.PlaneGeometry(.69,.21),mat('#ffffff',.6,label));sign.position.set(.05,1.85,-.08);g.add(sign);
  box(.19,.18,.2,-.46,1.01,-.05,black,g,.012);box(.17,.25,.12,-.46,1.23,-.06,ivory,g,.018);box(.12,.16,.015,-.46,1.24,.008,black,g,.01);box(.09,.02,.018,-.46,1.3,.018,mat('#d93e32'),g);
  box(.22,.015,.18,-.15,1.198,.12,black,g,.015);box(.075,.17,.018,.23,1.02,.304,black,g,.008);box(.25,.10,.08,-.16,.98,.32,black,g,.025);box(.28,.025,.13,-.16,.925,.33,ivory,g,.02);
  const staffTerminal=box(.24,.17,.035,.25,1.18,-.31,black,g,.012);staffTerminal.rotation.x=-.18;box(.19,.115,.006,.25,1.19,-.333,mat('#315b60',.25),g,.004);
  const terminal=box(.18,.04,.23,.51,.94,.12,black,g,.015);terminal.rotation.x=.28;cyl(.045,.05,.02,.51,.92,-.19,ivory,g);
 }
 const benchRuns=continuousBenches(items),benchRunById=new Map<string,Item[]>();
 for(const run of benchRuns)if(run.length>1)for(const member of run)benchRunById.set(member.id,run);
 for(const item of items){activeTableId=item.id;const g=new T.Group();g.position.set(item.x,0,item.z);g.rotation.y=-item.rotation*Math.PI/180;scene.add(g);if(isArt(item.kind)){artwork(item,g);continue;}switch(item.kind){case 'waitingStand':box(.4,.98,.35,0,.49,0,darkwood,g,.01);box(.45,.04,.4,0,1.0,0,top,g,.008);box(.24,.008,.30,0,1.028,0,mat('#fffef4'),g);for(let n=0;n<6;n++)box(.19,.002,.002,0,1.034,-.105+n*.035,mat('#b3b0a4'),g);break;case 'stool':g.userData.seat='chair';cyl(.20,.20,.028,0,.445,0,top,g);for(const x of[-1,1])for(const z of[-1,1]){const leg=box(.032,.43,.045,x*.15,.23,z*.15,wood,g,.01);leg.rotation.z=x*-.08;box(.055,.025,.055,x*.135,.426,z*.15,wood,g,.008);}break;case 'robot':robotMeshes.set(item.id,g);servi(g);break;case 'two':table(0,0,.82,.78,g);chair(0,.72,0,g);chair(0,-.72,Math.PI,g);break;case 'four':table(0,0,1.53,.8,g);bench(0,-.78,Math.PI,g);bench(0,.78,0,g);break;case 'table':table(0,0,.82,.78,g);break;case 'wideTable':table(0,0,1.53,.8,g);break;case 'chair':chair(0,0,0,g);break;case 'bench':{const run=benchRunById.get(item.id);if(!run){bench(0,0,0,g,benchRearHandrail(item,items,outline),item.screen===true);break;}if(run[0].id!==item.id)break;
 const first=run[0],last=run[run.length-1],a=item.rotation*Math.PI/180,c=Math.cos(a),sn=Math.sin(a),length=1.84+(last.x-first.x)*c+(last.z-first.z)*sn;
 const sofa=bench((length-1.84)/2,0,0,g,false,false,length);
 for(const member of run)if(benchRearHandrail(member,items,outline)){const rail=new T.Group();rail.position.x=(member.x-first.x)*c+(member.z-first.z)*sn-(length-1.84)/2;sofa.add(rail);if(member.screen)privacyScreen(rail,1.84,.30,1.17);else handrail(rail,1.84,.30,1.26);}
 break;}case 'partition':partition(g,item.id==='wc-screen'?1.65:1.25);break;case 'dividerWall':dividerWall(g,item,dividerHandrail(item,outline));break;case 'pillar':pillar(g,item.mirror===true);break;case 'plant':plant(g);break;case 'checkout':checkout(g);break;case 'drinkbar':drinkbar(g);break;case 'serviceTable':serviceTable(g);break;case 'staffSink':staffSink(g);break;}}

 // Clamp every table-top component away from room walls, including angled walls.
 scene.updateMatrixWorld(true);
 function fitMeal(meal:T.Group){for(const part of meal.children){const bounds=new T.Box3().setFromObject(part),corners=[[bounds.min.x,bounds.min.z],[bounds.min.x,bounds.max.z],[bounds.max.x,bounds.min.z],[bounds.max.x,bounds.max.z]];if(corners.some(([x,z])=>!canWalk(x,z,[],outline,.025))){const original=part.position.clone();let fits=false;for(const scale of [.8,.6,.4,0]){part.position.x=original.x*scale;part.position.z=original.z*scale;part.updateWorldMatrix(true,true);const b=new T.Box3().setFromObject(part);if([[b.min.x,b.min.z],[b.min.x,b.max.z],[b.max.x,b.min.z],[b.max.x,b.max.z]].every(([x,z])=>canWalk(x,z,[],outline,.025))){fits=true;break;}}if(!fits)part.visible=false;}}}
 meals.forEach(fitMeal);
 const cargoGroups=new Map<string,{foods:T.Group[];plates:T.Group}>();
 for(const [id,robot] of robotMeshes){const foods:T.Group[]=[];const plates=createTableMeal(0,.4,'plates');plates.position.set(0,1.055,-.025);robot.add(plates);cargoGroups.set(id,{foods,plates});}
 const raycaster=new T.Raycaster();let hoverHint='';
 function seatAt(e:PointerEvent){const rect=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hits=raycaster.intersectObjects(scene.children,true).filter(h=>{if(h.distance>=5)return false;let o:T.Object3D|null=h.object;while(o){if(!o.visible)return false;o=o.parent;}return true;});for(const hit of hits){let o:T.Object3D|null=hit.object;while(o&&!o.userData.seat)o=o.parent;if(o)return {group:o,point:hit.point};if(hit.distance>.1)return null;}return null;}
 function stand(){if(!seated)return;seated=false;camera.position.set(standingPosition.x,1.62,standingPosition.z);keys.clear();options.onSeat?.({seated:false,hint:'椅子をクリックして座れます'});}
 function sit(e:PointerEvent){const target=seatAt(e);if(!target)return;if(!seated){standingPosition.x=camera.position.x;standingPosition.z=camera.position.z;}const p=target.group.worldToLocal(target.point.clone());p.set(target.group.userData.seat==='bench'?Math.max(-(target.group.userData.seatHalfWidth??.7),Math.min(target.group.userData.seatHalfWidth??.7,p.x)):0,1.3,-.03);target.group.localToWorld(p);camera.position.copy(p);const dir=target.group.getWorldDirection(new T.Vector3());yaw=Math.atan2(dir.x,dir.z);pitch=-.08;seated=true;keys.clear();options.onSeat?.({seated:true,hint:'着席中 · ドラッグで見回せます'});}
 // First-person walking: collision checks are shared with the plan model.
 const keydown=(e:KeyboardEvent)=>{if((e.target as HTMLElement)?.closest('button,input,textarea,select,[role=slider]'))return;const key=e.key.toLowerCase();if(key==='e'&&seated){stand();return;}if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(key)){e.preventDefault();keys.add(key);}};
 const keyup=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase());const clear=()=>{keys.clear();if(gain&&audioContext)gain.gain.setTargetAtTime(0,audioContext.currentTime,.03);};
 let dragging=false,px=0,py=0,downX=0,downY=0,moved=false;const down=(e:PointerEvent)=>{if(e.button!==0)return;dragging=true;moved=false;downX=px=e.clientX;downY=py=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);renderer.domElement.focus();};
 const movePointer=(e:PointerEvent)=>{if(!dragging){const target=seatAt(e),hint=target?'クリックでこの席に座る':seated?'着席中 · ドラッグで見回せます':'椅子をクリックして座れます';renderer.domElement.style.cursor=target?'pointer':'grab';if(hint!==hoverHint){hoverHint=hint;options.onSeat?.({seated,hint});}return;}if(Math.hypot(e.clientX-downX,e.clientY-downY)>5)moved=true;if(moved){yaw+=(invertX?1:-1)*(e.clientX-px)*.004;pitch=Math.max(-1.25,Math.min(1.25,pitch+(invertY?1:-1)*(e.clientY-py)*.004));}px=e.clientX;py=e.clientY;};const up=(e:PointerEvent)=>{if(dragging&&!moved&&e.type==='pointerup')sit(e);dragging=false;};
 renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','3D店内。ドラッグで見回し、WASDまたは矢印キーで歩きます。');renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',movePointer);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',up);window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
 const resize=()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(host);resize();let frame=0,last=performance.now(),lastNotify=0;const tick=(now:number)=>{frame=requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.045);last=now;let forward=Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown')),right=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));const length=Math.hypot(forward,right);if(length&&!seated){forward/=length;right/=length;const speed=(keys.has('shift')?2.9:1.7)*dt;const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*right)*speed,dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*right)*speed;if(canWalk(camera.position.x+dx,camera.position.z,obstacles,outline))camera.position.x+=dx;if(canWalk(camera.position.x,camera.position.z+dz,obstacles,outline))camera.position.z+=dz;}for(const w of outsideWalkers){const span=w.span+2,progress=((now*.001*w.speed+w.phase*span)%span);w.person.position.x=progress-span/2;const wx=(w.edge.a.x+w.edge.b.x)/2+w.edge.tx*w.person.position.x-w.edge.nx*.8,wz=(w.edge.a.z+w.edge.b.z)/2+w.edge.tz*w.person.position.x-w.edge.nz*.8;w.person.visible=Math.abs(w.person.position.x)<w.span/2-.12&&!inside({x:wx,z:wz},outline);w.legs[0].rotation.z=Math.sin(now*.001*2.1+w.phase*6)*.25;w.legs[1].rotation.z=-w.legs[0].rotation.z;}fleet.step(dt,{x:camera.position.x,z:camera.position.z},robotPaused);let motorLevel=0;for(const r of fleet.states()){const previous=audioLast.get(r.id);if(previous&&!r.hidden&&Math.hypot(r.x-previous.x,r.z-previous.z)>.0001)motorLevel+=.025/(1+Math.hypot(r.x-camera.position.x,r.z-camera.position.z));audioLast.set(r.id,{x:r.x,z:r.z});const mesh=robotMeshes.get(r.id)!;mesh.position.x=r.x;mesh.position.z=r.z;mesh.rotation.y=r.yaw;mesh.visible=!r.hidden&&inside({x:r.x,z:r.z},outline);const cargo=cargoGroups.get(r.id)!;if(foodVisible&&r.cargo==='food'&&!cargo.foods[r.variant%12]){for(const old of cargo.foods){if(!old)continue;old.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});old.removeFromParent();}cargo.foods.length=0;const group=new T.Group();for(let tier=0;tier<2;tier++){const dish=createTableMeal((r.variant+tier)%12,.4,'cargo');dish.scale.setScalar(.85);dish.position.set(0,tier?.73:1.055,-.025);group.add(dish);}mesh.add(group);cargo.foods[r.variant%12]=group;}cargo.foods.forEach((g,n)=>g.visible=foodVisible&&r.cargo==='food'&&r.variant%12===n);cargo.plates.visible=foodVisible&&r.cargo==='plates';}if(gain&&audioContext)gain.gain.setTargetAtTime(soundEnabled&&!document.hidden?Math.min(.055,motorLevel):0,audioContext.currentTime,.1);for(const event of fleet.drainEvents()){const meal=mealByTable.get(event.tableId);if(meal){if(event.type==='delivered'){for(const t of meal.userData.textures??[]){t.dispose();const index=textures.indexOf(t);if(index>=0)textures.splice(index,1);}for(const child of [...meal.children]){child.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});meal.remove(child);}const replacement=createTableMeal(event.variant,meal.userData.width);meal.userData.textures=replacement.userData.textures;textures.push(...replacement.userData.textures);for(const child of [...replacement.children])meal.add(child);meal.updateWorldMatrix(true,true);fitMeal(meal);}meal.userData.served=event.type==='delivered';meal.visible=foodVisible&&meal.userData.served;}}camera.rotation.set(pitch,yaw,0,'YXZ');renderer.render(scene,camera);if(now-lastNotify>200){onPosition?.(camera.position.x,camera.position.z,yaw);options.onRobot?.(fleet.states());lastNotify=now;}};frame=requestAnimationFrame(tick);
 return {sound,stand,look(x,y){invertX=x;invertY=y;},food(enabled){foodVisible=enabled;meals.forEach(g=>g.visible=enabled&&g.userData.served!==false);flatMenus.forEach(g=>g.visible=!enabled);},robotPaused(paused){robotPaused=paused;},reset(){seated=false;options.onSeat?.({seated:false,hint:"椅子をクリックして座れます"});camera.position.set(spawn.x,1.62,spawn.z);yaw=initialYaw;pitch=-.08;keys.clear();},move(direction,active){if(active)keys.add(direction);else keys.delete(direction);},lighting(n){sun.intensity=n?.18:3.4;hemi.intensity=n?.65:2;lamps.forEach(l=>l.intensity=n?17:9);scene.background=new T.Color(n?'#263c42':'#d1d9d1');renderer.toneMappingExposure=n?1.25:1.1;},lens(v){camera.fov=v;camera.updateProjectionMatrix();},async capture(){const old=renderer.getSize(new T.Vector2()),ratio=renderer.getPixelRatio(),aspect=camera.aspect;let blob:Blob|null=null;try{renderer.setPixelRatio(1);renderer.setSize(1920,1080,false);camera.aspect=16/9;camera.updateProjectionMatrix();renderer.render(scene,camera);blob=await new Promise<Blob|null>(resolve=>renderer.domElement.toBlob(resolve,'image/png'));}finally{renderer.setPixelRatio(ratio);renderer.setSize(old.x,old.y,false);camera.aspect=aspect;camera.updateProjectionMatrix();renderer.render(scene,camera);}if(!blob)throw Error('PNG export failed');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`saize-room-${Date.now()}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},dispose(){osc?.stop();void audioContext?.close();cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointermove',movePointer);renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('pointercancel',up);scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();}};
}



