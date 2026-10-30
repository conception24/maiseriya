import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const require=createRequire(path.resolve('package.json')),ts=require('typescript');fs.mkdirSync('work/model-test',{recursive:true});
for(const name of['geometry','floor-plan','robot-navigation','robot-fleet','seating-rules','layout-quality','service-layout','dining-planner','random-layout','table-arrangement','decor-placement','edit-operations','layout-review','review-prefetch']){const source=fs.readFileSync(`app/${name}.ts`,'utf8'),js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(.+?)'/g,"from '$1.mjs'");fs.writeFileSync(`work/model-test/${name}.mjs`,js);}
const m=await import(pathToFileURL(path.resolve('work/model-test/floor-plan.mjs'))),g=await import(pathToFileURL(path.resolve('work/model-test/geometry.mjs'))),{createNavigator}=await import(pathToFileURL(path.resolve('work/model-test/robot-navigation.mjs')));
const initial=m.initialLayout();assert.equal(m.parseDocument({version:2,...initial}).items.length,16);assert.equal(m.parseDocument({version:1,items:initial.items.filter(i=>!m.isArt(i.kind)&&i.kind!=='robot')}).chairStyle,'woven');
assert.equal(m.parseDocument({version:1,items:[]}).foodEnabled,true);
assert.equal(m.parseDocument(JSON.parse(JSON.stringify({version:2,...initial,foodEnabled:false}))).foodEnabled,false);
assert.throws(()=>m.parseDocument({version:2,...initial,foodEnabled:'false'}));
assert.throws(()=>m.parseDocument({version:2,...initial,outline:[{x:NaN,z:0}]}));assert.throws(()=>m.parseLayout([{...initial.items[0],kind:'__proto__'}]));assert.throws(()=>m.parseLayout([initial.items[0],initial.items[0]]));
assert.equal(m.placementError({id:'ok',kind:'chair',x:1.25,z:3.5,rotation:90},initial.items),null);assert.equal(m.placementError({id:'r2',kind:'robot',x:3,z:3,rotation:0},initial.items),null);
assert.match(m.placementError({id:'entry',kind:'table',x:0,z:5.75,rotation:0},initial.items),/入口/);assert.match(m.placementError({id:'overlap',kind:'two',x:-1.25,z:0,rotation:0},initial.items),/重な/);
const diagonal=[{x:-4,z:-8.5},{x:6,z:-8.5},{x:6,z:6.5},{x:-6,z:6.5},{x:-6,z:-6.5}];assert.equal(g.outlineError(diagonal),null);assert(!m.canWalk(-5.8,-8,[],diagonal));assert(m.canWalk(-4,-6,[],diagonal));const art=m.snapArt({id:'art',kind:'cherubs',x:-5,z:-7.5,rotation:0},diagonal);assert.equal(m.placementError(art,[],diagonal),null);assert(Math.abs(art.rotation%90)>1);
const crossing=[{x:0,z:0},{x:6,z:5},{x:6,z:0},{x:0,z:6}];assert(g.outlineError(crossing));
const home=initial.items.find(i=>i.kind==='robot'),nav=createNavigator(initial.items,initial.outline,home);assert(nav.goals.length>1);let current=home,steps=0;for(const goal of nav.goals){const route=nav.route(current,goal);for(const p of route){assert(nav.canMove(p));assert(Math.hypot(p.x-current.x,p.z-current.z)<=.251);for(let t=.1;t<=1;t+=.1)assert(nav.canMove({x:current.x+(p.x-current.x)*t,z:current.z+(p.z-current.z)*t}));current=p;steps++;}}assert(steps>10);
// A solid wall of furniture separates the room. The robot must never route across it.
const blocked=[-5.25,-3.5,-1.75,0,1.75,3.5,5.25].map((x,i)=>({id:`p${i}`,kind:'partition',x,z:0,rotation:0}));const blockedNav=createNavigator(blocked,m.DEFAULT_OUTLINE,{x:0,z:3});assert.equal(blockedNav.route({x:0,z:3},{x:0,z:-3}).length,0);
console.log(`PASS: migration, persisted layout validation, art snapping to diagonal wall, room/entry/furniture collision, polygon rejection, robot ${steps} safe route steps, blocked route rejection.`);


const extra=[{id:'r2',kind:'robot',x:3,z:3,rotation:0},{id:'r3',kind:'robot',x:3,z:4,rotation:0},{id:'r4',kind:'robot',x:4,z:3,rotation:0},{id:'r5',kind:'robot',x:4,z:4,rotation:0}],fleetItems=[...initial.items.filter(i=>i.kind!=='robot'||i.id==='servi-1'),...extra];assert.equal(m.parseLayout(fleetItems).length,18);assert.match(m.placementError({id:'r6',kind:'robot',x:5,z:4,rotation:0},fleetItems),/5台/);
const bench={id:'benchA',kind:'bench',x:0,z:0,rotation:0},back={id:'benchB',kind:'bench',x:0,z:.66,rotation:180};assert.equal(m.placementError(back,[bench]),null);const snapped=m.snapPlacement({...back,z:.72},[bench],m.DEFAULT_OUTLINE);assert(Math.abs(snapped.z-.66)<1e-6);assert(m.placementError({...back,z:.6},[bench]));
const wall={id:'wallA',kind:'partition',x:0,z:0,rotation:0},joint=m.snapPlacement({id:'wallB',kind:'partition',x:1.9,z:0,rotation:0},[wall],m.DEFAULT_OUTLINE);assert(Math.abs(joint.x-1.8)<1e-6);assert.equal(m.placementError(joint,[wall]),null);
const logo=m.snapArt({id:'logo',kind:'logo',x:3,z:6.5,rotation:0,side:'outside'},m.DEFAULT_OUTLINE);assert.equal(m.placementError(logo,[]),null);assert.equal(m.parseLayout([logo])[0].side,'outside');
const {createFleet}=await import(pathToFileURL(path.resolve('work/model-test/robot-fleet.mjs'))),fleet=createFleet(fleetItems,m.DEFAULT_OUTLINE),starts=fleet.states();let moved=new Set(),phases=new Set(),eventTypes=new Set();for(let step=0;step<12000;step++){fleet.step(1/30,{x:0,z:6},false);for(const e of fleet.drainEvents())eventTypes.add(e.type);const states=fleet.states();for(let i=0;i<states.length;i++){assert(Number.isFinite(states[i].x));phases.add(states[i].phase);if(!['enter','hidden','exit'].includes(states[i].phase))assert(m.canWalk(states[i].x,states[i].z,m.colliders(fleetItems),m.DEFAULT_OUTLINE,.3));if(Math.hypot(states[i].x-starts[i].x,states[i].z-starts[i].z)>.5)moved.add(i);for(let j=i+1;j<states.length;j++)if(!states[i].hidden&&!states[j].hidden)assert(Math.hypot(states[i].x-states[j].x,states[i].z-states[j].z)>=.589);}}assert.equal(moved.size,5);assert(phases.has('hidden'));assert(phases.has('exit'));assert(eventTypes.has('delivered'));assert(eventTypes.has('collected')); const stopped=fleet.states();fleet.step(1,{x:0,z:6},true);assert.deepEqual(fleet.states().map(r=>[r.x,r.z]),stopped.map(r=>[r.x,r.z]));console.log('PASS: 5 robot limit, all five move, 400-second collision simulation, kitchen enter/exit, delivery/collection, pause, back-to-back seating, wall contact, exterior logo persistence.');



const {selectInBox,deleteSelection}=await import(pathToFileURL(path.resolve('work/model-test/edit-operations.mjs')));
const editable=[{id:'a',kind:'table',x:0,z:0,rotation:0},{id:'b',kind:'partition',x:1,z:1,rotation:90},{id:'c',kind:'table',x:4,z:4,rotation:0}];
const selected=selectInBox(editable,{x:2,z:2},{x:-1,z:-1});assert.deepEqual(selected,['a','b']);assert.deepEqual(deleteSelection(editable,selected).map(i=>i.id),['c']);assert.equal(editable.length,3);
const warmed=createFleet(initial.items,initial.outline,24);assert(warmed.states().some(r=>Math.hypot(r.x-initial.items.find(i=>i.id===r.id).x,r.z-initial.items.find(i=>i.id===r.id).z)>.5));assert.equal(warmed.drainEvents().length,0);
console.log('PASS: reverse-direction rectangular selection, batch removal preserves source, warm-started fleet.');

// An open right-angle route must bend continuously, rather than stop at a grid corner.
const curveNav=createNavigator([],m.DEFAULT_OUTLINE,{x:-3,z:3});
const curve=[{x:-3,z:3},...curveNav.route({x:-3,z:3},{x:3,z:-3})];let diagonals=0,previousHeading=null,maxBend=0;
for(let n=1;n<curve.length;n++){const a=curve[n-1],b=curve[n],dx=b.x-a.x,dz=b.z-a.z;if(Math.hypot(dx,dz)<.000001)continue;if(Math.abs(dx)>.0001&&Math.abs(dz)>.0001)diagonals++;const heading=Math.atan2(dz,dx);if(previousHeading!==null)maxBend=Math.max(maxBend,Math.abs(Math.atan2(Math.sin(heading-previousHeading),Math.cos(heading-previousHeading))));previousHeading=heading;assert(curveNav.canMove(b));}
assert(diagonals>10);assert(maxBend<.15,`sharp bend ${maxBend}`);console.log('PASS: rounded right-angle route, intermediate diagonal positions, continuous path tangent.');

// A four-table bench run can either seat a group or offer three evenly spaced tables.
const {banquetteRun}=await import(pathToFileURL(path.resolve('work/model-test/seating-rules.mjs')));
const {rackOwner}=await import(pathToFileURL(path.resolve('work/model-test/table-arrangement.mjs')));
for(const rotation of [0,90,180,270]){
 const joined=banquetteRun('joined',0,0,rotation,[4]);const spaced=banquetteRun('spaced',0,0,rotation,[4],true);
 const jt=joined.items.filter(i=>i.kind==='table'),st=spaced.items.filter(i=>i.kind==='table');
 assert.equal(jt.length,4);assert.equal(st.length,3);assert.equal(spaced.items.filter(i=>i.kind==='chair').length,3);assert.equal(spaced.length,joined.length);
 assert(Math.abs(Math.hypot(st[1].x-st[0].x,st[1].z-st[0].z)-Math.hypot(st[2].x-st[1].x,st[2].z-st[1].z))<1e-8);
 assert.equal(jt.filter(i=>rackOwner(i,joined.items)).length,1);assert.equal(st.filter(i=>rackOwner(i,spaced.items)).length,3);
}
const savedDefault=JSON.parse(fs.readFileSync('app/default-layout.json','utf8'));assert(savedDefault.items.some(i=>i.kind==='bench'));assert(savedDefault.items.some(i=>i.kind==='checkout'));assert.equal(savedDefault.items.filter(i=>i.kind==='robot').length,3);assert.equal(m.parseDocument({version:2,...savedDefault}).items.length,savedDefault.items.length);
console.log('PASS: joined and spaced bench tables, one rack per joined group, new initial layout round-trip.');

const {continuousBenches}=await import(pathToFileURL(path.resolve('work/model-test/seating-rules.mjs')));
for(const rotation of [0,90,180,270]){
 const run=banquetteRun('continuous',0,0,rotation,[4]),benches=run.items.filter(i=>i.kind==='bench');
 assert.equal(continuousBenches(benches).length,1);assert.equal(continuousBenches(benches)[0].length,2);
 assert.equal(continuousBenches([benches[0],{...benches[1],rotation:(rotation+180)%360}]).length,2);
 const a=rotation*Math.PI/180;assert.equal(continuousBenches([benches[0],{...benches[1],x:benches[1].x+Math.cos(a)*.08,z:benches[1].z+Math.sin(a)*.08}]).length,2);
 const third={...benches[1],id:'third',x:benches[1].x+1.84*Math.cos(a),z:benches[1].z+1.84*Math.sin(a)};
 assert.equal(continuousBenches([third,benches[0],benches[1]])[0].length,3);
}
console.log('PASS: continuous bench runs in four orientations, independent opposite or separated seats.');

const basin=savedDefault.items.find(i=>i.kind==='staffSink');assert(basin,'default plan includes staff basin');
const defaultNav=createNavigator(savedDefault.items,savedDefault.outline,m.spawnPoint(savedDefault.outline,savedDefault.items));assert(Math.hypot(basin.x-defaultNav.kitchens[0].door.x,basin.z-defaultNav.kitchens[0].door.z)<2.5);assert(defaultNav.kitchens.every(k=>defaultNav.reachable(k.point,.35)));assert(!m.canWalk(basin.x,basin.z,m.colliders(savedDefault.items),savedDefault.outline,.2));
console.log('PASS: default kitchen hand basin is placed near its doorway, blocks movement, and leaves the kitchen accessible.');

assert.equal(m.parseDocument({version:2,...savedDefault,chairStyle:'wovenDiamond'}).chairStyle,'wovenDiamond');
assert.equal(m.parseDocument({version:2,...savedDefault,chairStyle:'woven'}).chairStyle,'woven');
console.log('PASS: both woven chair patterns survive layout export and import.');

const {checkoutNeedsScreen,screenBlocksView}=await import(pathToFileURL(path.resolve('work/model-test/service-layout.mjs')));
const wallCheckout={id:'register-wall',kind:'checkout',x:0,z:-7.45,rotation:0},openCheckout={...wallCheckout,id:'register-open',z:0};
assert(!checkoutNeedsScreen(wallCheckout,[wallCheckout],m.DEFAULT_OUTLINE),'wall closes rear access');assert(checkoutNeedsScreen(openCheckout,[openCheckout],m.DEFAULT_OUTLINE),'open rear needs a screen');
const testScreen={id:'screen',kind:'partition',x:0,z:0,rotation:0};assert(screenBlocksView(testScreen,{x:0,z:2},{x:0,z:-2}));assert(!screenBlocksView(testScreen,{x:2,z:2},{x:2,z:-2}));
assert(savedDefault.items.filter(i=>i.kind==='stool').length>=5,'initial waiting stools');assert(savedDefault.items.some(i=>i.kind==='waitingStand'),'initial waiting list stand');
console.log('PASS: staff-side screen decisions, restroom line of sight, and initial waiting stools.');

