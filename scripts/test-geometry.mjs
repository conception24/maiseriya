import assert from 'node:assert/strict';
import {circleClear,createCircleChecker,corners,intersects,DEFAULT_OUTLINE} from '../work/model-test/geometry.mjs';
import {initialLayout,colliders,spawnPoint} from '../work/model-test/floor-plan.mjs';
import {createNavigator} from '../work/model-test/robot-navigation.mjs';
let seed=83;const random=()=>((seed=seed*16807%2147483647)-1)/2147483646;
function referenceIntersection(a,b,gap=0){const aa=corners({...a,w:a.w+gap,d:a.d+gap}),bb=corners({...b,w:b.w+gap,d:b.d+gap});for(const r of[a,b])for(const angle of[r.rotation,r.rotation+90]){const rad=angle*Math.PI/180,project=p=>p.x*Math.cos(rad)+p.z*Math.sin(rad),ap=aa.map(project),bp=bb.map(project);if(Math.max(...ap)<=Math.min(...bp)||Math.max(...bp)<=Math.min(...ap))return false;}return true;}
const angles=[0,90,180,270,-90,45,135,26.56505117707799],gaps=[0,-.0001,.08,-.05];
for(let n=0;n<15000;n++){const rect=()=>({x:random()*20-10,z:random()*20-10,w:.1+random()*4,d:.1+random()*4,rotation:angles[Math.floor(random()*angles.length)]});const a=rect(),b=rect(),gap=gaps[n%gaps.length];assert.equal(intersects(a,b,gap),referenceIntersection(a,b,gap));}
for(const angle of angles)for(const epsilon of[-1e-9,0,1e-9]){const a={x:0,z:0,w:2,d:1,rotation:angle},b={...a,x:Math.cos(angle*Math.PI/180)*(2+epsilon),z:Math.sin(angle*Math.PI/180)*(2+epsilon)};assert.equal(intersects(a,b),referenceIntersection(a,b));}
const base=initialLayout(),obstacles=colliders(base.items),outlines=[DEFAULT_OUTLINE,[{x:-6,z:-8},{x:-2,z:-8},{x:-2,z:-1},{x:2,z:-1},{x:2,z:-8},{x:6,z:-8},{x:6,z:8},{x:-6,z:8}],[{x:-4,z:-8.5},{x:6,z:-8.5},{x:6,z:6.5},{x:-6,z:6.5},{x:-6,z:-6.5}]];
for(const outline of outlines)for(const radius of[.19,.28,.3]){const fast=createCircleChecker(obstacles,outline,radius);for(let n=0;n<4000;n++){const x=n%2?random()*14-7:Math.round((random()*14-7)*16)/16,z=n%2?random()*18-9:Math.round((random()*18-9)*16)/16;assert.equal(fast(x,z),circleClear(x,z,obstacles,outline,radius));}}
const polygon=DEFAULT_OUTLINE.map(p=>({...p})),free=createCircleChecker([],polygon,.3);assert(free(0,0));const occupied=createCircleChecker([{x:0,z:0,w:2,d:2,rotation:45}],polygon,.3);assert(!occupied(0,0));assert(free(0,0));assert(createCircleChecker([],polygon,.19)(-5.65,0));assert(!createCircleChecker([],polygon,.3)(-5.65,0));assert(free(5,0));polygon[1].x=4;polygon[2].x=4;assert(!createCircleChecker([],polygon,.3)(5,0));
// Independently flood the reference collision grid, then compare local lookups
// against an exhaustive component scan, including disconnected rooms.
for(const items of[base.items,[-5.25,-3.5,-1.75,0,1.75,3.5,5.25].map((x,n)=>({id:`p${n}`,kind:'partition',x,z:0,rotation:0}))]){
 const home=spawnPoint(DEFAULT_OUTLINE,items),obs=colliders(items),nav=createNavigator(items,DEFAULT_OUTLINE,home,{services:false}),queue=[home],seen=new Set([`${home.x},${home.z}`]);
 for(let n=0;n<queue.length;n++){const p=queue[n];for(const [dx,dz]of[[-.25,0],[.25,0],[0,-.25],[0,.25]]){const q={x:p.x+dx,z:p.z+dz},key=`${q.x},${q.z}`;if(seen.has(key)||![.25,.5,.75,1].every(t=>circleClear(p.x+dx*t,p.z+dz*t,obs,DEFAULT_OUTLINE,.3)))continue;seen.add(key);queue.push(q);}}
 for(let n=0;n<1000;n++){const p={x:random()*14-7,z:random()*18-9},t=[.0001,.22,.3,.35,.55][n%5];assert.equal(nav.reachable(p,t),queue.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<=t));}
}
console.log('PASS: 15,000 rectangle comparisons, 36,000 prepared collision checks, touching/angled rectangles, changed furniture/outline/radius caches, and 2,000 connected-component reachability comparisons.');
