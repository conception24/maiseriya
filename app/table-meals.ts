import * as T from 'three';

// Stylized, fully 3D servings based on the official popular-menu photographs.
export function createTableMeal(index:number,width:number,mode:'table'|'cargo'|'plates'='table'):T.Group {
 const root=new T.Group();root.name='料理・マグナム・取り皿';root.userData.textures=[];
 let seed=73+index*193;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
 const material=(color:string,roughness=.6)=>new T.MeshStandardMaterial({color,roughness});
 const china=material('#f8f4df',.25),crust=material('#c98d37'),cheese=material('#efcf7c'),sauce=material('#a64120'),herb=material('#497634');
 function mesh(geo:T.BufferGeometry,mat:T.Material,parent:T.Object3D,x=0,y=0,z=0){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function disc(r:number,h:number,mat:T.Material,p:T.Object3D,x=0,y=0,z=0){return mesh(new T.CylinderGeometry(r,r,h,40),mat,p,x,y,z);}
 function blob(x:number,y:number,z:number,sx:number,sy:number,sz:number,mat:T.Material,p:T.Object3D){const m=mesh(new T.SphereGeometry(1,12,8),mat,p,x,y,z);m.scale.set(sx,sy,sz);return m;}
 function plate(p:T.Object3D,r:number,x:number,z:number){const shape=[[0,0],[r*.78,0],[r,.008],[r,.017],[r*.76,.011],[0,.011]].map(([a,b])=>new T.Vector2(a,b));return mesh(new T.LatheGeometry(shape,40),china,p,x,0,z);}
 function dish(kind:number,x:number,z:number){const p=new T.Group();p.position.set(x,0,z);root.add(p);p.name=['ミラノ風ドリア','マルゲリータ','辛味チキン','小エビのサラダ','ペペロンチーノ','イタリアンプリン','青豆の温サラダ','ハンバーグ'][kind%8];
  if(kind===0){ // Oval ceramic gratin dish, cream sauce and central meat sauce.
   plate(p,.13,0,0).scale.z=.75;const rim=mesh(new T.TorusGeometry(.116,.012,10,48),china,p,0,.029,0);rim.rotation.x=Math.PI/2;rim.scale.y=.75;
   const filling=disc(.109,.022,cheese,p,0,.025);filling.scale.z=.74;
   for(let i=0;i<70;i++){const a=random()*Math.PI*2,r=Math.sqrt(random())*.1;blob(Math.cos(a)*r,.039,Math.sin(a)*r*.74,.003+random()*.005,.0015,.003, i%3?cheese:crust,p);}
   for(let i=0;i<36;i++){const a=random()*Math.PI*2,r=Math.sqrt(random())*.052;blob(Math.cos(a)*r,.043,Math.sin(a)*r*.7,.009,.004,.007,i%3?sauce:material('#743522'),p);}
   for(const side of[-1,1])blob(side*.136,.02,0,.023,.009,.023,china,p);
  }else if(kind===1){
   plate(p,.147,0,0);disc(.134,.012,crust,p,0,.02);disc(.12,.006,sauce,p,0,.029);
   const rim=mesh(new T.TorusGeometry(.127,.007,8,48),crust,p,0,.029,0);rim.rotation.x=Math.PI/2;
   for(let i=0;i<13;i++){const a=i*2.4,r=Math.sqrt((i+.5)/13)*.102;blob(Math.cos(a)*r,.035,Math.sin(a)*r,.019,.003,.016,cheese,p);}
   for(let i=0;i<6;i++){const a=i*1.047;const leaf=blob(Math.cos(a)*.07,.04,Math.sin(a)*.07,.009,.002,.018,herb,p);leaf.rotation.y=a;}
   for(let i=0;i<30;i++){const a=random()*6.28,r=.12+random()*.012;blob(Math.cos(a)*r,.034,Math.sin(a)*r,.003,.001,.002,material('#805326'),p);}
  }else if(kind===2){
   plate(p,.135,0,0);const skin=material('#b66a2d'),browned=material('#87431f');
   for(let i=0;i<5;i++){const a=i*1.256,piece=new T.Group();piece.position.set(Math.cos(a)*.065,.035,Math.sin(a)*.058);piece.rotation.y=a; p.add(piece);blob(0,0,0,.026,.02,.042,skin,piece);blob(0,-.003,.044,.014,.012,.023,skin,piece);for(let n=0;n<8;n++)blob((random()-.5)*.035,.018+random()*.004,(random()-.5)*.05,.004,.002,.006,n%2?browned:crust,piece);}
  }
  else if(kind===3){plate(p,.125,0,0);for(let i=0;i<30;i++){const a=random()*6.28,r=Math.sqrt(random())*.09;const leaf=blob(Math.cos(a)*r,.025+random()*.025,Math.sin(a)*r,.024,.005,.018,material(i%2?'#73a341':'#a8c75e'),p);leaf.rotation.set(random(),a,random()*.3);}for(let i=0;i<8;i++){const a=i*2.4;const shrimp=mesh(new T.TorusGeometry(.012,.005,6,10,4.7),material('#efaa85'),p,Math.cos(a)*.065,.06,Math.sin(a)*.065);shrimp.rotation.x=Math.PI/2;}}
  else if(kind===4){plate(p,.13,0,0);for(let n=0;n<24;n++){const points=[];for(let k=0;k<15;k++){const a=k*.6+n,rr=.025+(n%5)*.014;points.push(new T.Vector3(Math.cos(a)*rr,.02+n*.0008+Math.sin(k)*.003,Math.sin(a)*rr));}mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),22,.002,4,false),cheese,p);}for(let i=0;i<8;i++)blob((random()-.5)*.12,.05,(random()-.5)*.12,.004,.002,.007,sauce,p);}
  else if(kind===5){plate(p,.095,0,0);disc(.052,.003,sauce,p,0,.014);mesh(new T.CylinderGeometry(.039,.05,.045,32),material('#efc66b',.3),p,0,.037);disc(.039,.003,material('#884622',.25),p,0,.061);}
  else if(kind===6){plate(p,.112,0,0);for(let n=0;n<65;n++){const a=n*2.4,r=Math.sqrt(random())*.085;blob(Math.cos(a)*r,.02+random()*.012,Math.sin(a)*r,.006,.006,.006,herb,p);}blob(0,.045,0,.033,.018,.028,china,p);blob(0,.057,0,.014,.006,.014,material('#e7ad2b'),p);}
  else {plate(p,.13,0,0);blob(-.015,.04,0,.075,.023,.05,material('#644026'),p);blob(-.015,.061,0,.065,.003,.042,sauce,p);for(let i=0;i<6;i++)blob(.08,.023,(i-3)*.018,.022,.012,.007,cheese,p);}

 }

 if(mode==='cargo'){dish(index%8,0,0);return root;}
 if(mode==='plates'){for(let n=0;n<3;n++){const p=plate(root,.11,0,0);p.position.y=n*.012;}return root;}
 const large=width>1;
 if(large){[[-.43,.1],[-.1,.1],[.23,.1],[0,-.21],[.32,-.21]].forEach(([x,z],n)=>dish((index+n)%8,x,z));}
 else {dish(index%8,-.2,.09);dish((index+3)%8,.1,.1);root.children[1].scale.setScalar(.78);}
 const right=width/2-.115;
 for(let n=0;n<(large?4:2);n++){const p=plate(root,.068,right,.265);p.position.y=n*.009;}
 const glassMat=new T.MeshPhysicalMaterial({color:'#e3ece7',roughness:.12,transparent:true,opacity:.24,side:T.DoubleSide,depthWrite:false});
 const wine=index%8===0||index%8===5,white=index%8===5;
 const gx=right,gz=large?.025:-.03;
 if(wine){disc(.029,.004,glassMat,root,gx,.003,gz);disc(.003,.055,glassMat,root,gx,.03,gz);mesh(new T.LatheGeometry([[.004,.055],[.025,.065],[.034,.09],[.029,.13],[.027,.13],[.032,.09],[.023,.068],[.004,.058]].map(([a,b])=>new T.Vector2(a,b)),28),glassMat,root,gx,0,gz);disc(.027,.023,material(white?'#e6d58e':'#6e1930',.23),root,gx,.082,gz);}
 else {mesh(new T.LatheGeometry([[.025,0],[.03,.005],[.036,.095],[.033,.095],[.027,.009]].map(([a,b])=>new T.Vector2(a,b)),24),glassMat,root,gx,0,gz);const liquid=new T.MeshStandardMaterial({color:index%3===0?'#ed9b23':'#c7e3ea',roughness:.23,transparent:true,opacity:index%3===0?.85:.4});disc(.03,.055,liquid,root,gx,.033,gz);}
 // Only a quarter of tables have a magnum; the others may order glasses or soft drinks.
 if(index%8!==0&&index%8!==5)return root;
 // 1.5 L bottle: wider body, sloping shoulders, long neck, paper label.
 const bottle=new T.Group();bottle.position.set(right,0,-.245);root.add(bottle);
 const greenGlass=material(index%8===5?'#77843c':'#263b1c',.2);greenGlass.metalness=.15;
 mesh(new T.LatheGeometry([[0,0],[.042,0],[.047,.015],[.047,.235],[.041,.26],[.019,.285],[.017,.35],[0,.35]].map(([a,b])=>new T.Vector2(a,b)),40),greenGlass,bottle);
 const cap=material(index%8===5?'#c4ba89':'#702225',.38);disc(.018,.034,cap,bottle,0,.35);
 const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=256;const c=labelCanvas.getContext('2d')!;c.fillStyle='#f4ecd1';c.fillRect(0,0,512,256);c.strokeStyle='#9e3439';c.lineWidth=5;c.strokeRect(12,12,488,232);c.textAlign='center';c.fillStyle='#9c2834';c.font='italic bold 53px Georgia';c.fillText('Saizeriya',256,100);c.fillStyle='#33452c';c.font='26px Georgia';c.fillText('MAGNUM',256,155);c.font='21px Georgia';c.fillText(index%8===5?'VINO BIANCO · 1500 ml':'VINO ROSSO · 1500 ml',256,202);
 const texture=new T.CanvasTexture(labelCanvas);texture.colorSpace=T.SRGBColorSpace;root.userData.textures=[texture];
 mesh(new T.CylinderGeometry(.0475,.0475,.107,40,1,true),new T.MeshStandardMaterial({map:texture,roughness:.8}),bottle,0,.143);
 return root;
}

