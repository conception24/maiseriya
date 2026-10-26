import {dividerSpan} from '../work/model-test/seating-rules.mjs';
import assert from 'node:assert/strict';
import {initialLayout,parseDocument,spawnPoint} from '../work/model-test/floor-plan.mjs';
import {randomArrangement,randomRoom} from '../work/model-test/random-layout.mjs';
import {chairClearance,spatialQuality} from '../work/model-test/layout-quality.mjs';
import {createNavigator} from '../work/model-test/robot-navigation.mjs';
import {assess,proposals} from '../work/model-test/layout-review.mjs';
const rng=seed=>()=>((seed=seed*16807%2147483647)-1)/2147483646;
const base=initialLayout();
const chair={id:'chair',kind:'chair',x:0,z:0,rotation:0};
const open={...base,items:[chair]},obstructed={...base,items:[chair,{id:'wall',kind:'dividerWall',x:0,z:.65,rotation:0}]};
assert.equal(chairClearance(open),1);assert.equal(chairClearance(obstructed),0,'a non-overlapping chair still needs room to pull back');
const isolated={...base,items:[{id:'pillar',kind:'pillar',x:0,z:0,rotation:0}]};
const quality=l=>spatialQuality(l,createNavigator(l.items,l.outline,spawnPoint(l.outline,l.items),{services:false}));
assert.equal(quality(isolated).structure,0,'a disconnected column cannot earn structure credit');
for(const mirror of[.2,.8])for(const seed of[21,137,12345]){
 let call=0;const outline=randomRoom(()=>[0,0,3.5*.98/16,mirror][call++]);
 const source={...base,outline},snapshot=JSON.stringify(source),layout=randomArrangement(source,rng(seed));
 assert.equal(JSON.stringify(source),snapshot,'generation never changes the source plan');
 assert.deepEqual(layout,randomArrangement(source,rng(seed)),'same room and seed reproduce the entire plan');
 parseDocument({version:2,...layout});assert.deepEqual(layout.outline,outline);
 assert.equal(new Set(layout.items.map(i=>i.id)).size,layout.items.length,'a candidate cannot be committed twice');
 const a=assess(layout);assert.equal(a.blocked,0);assert.equal(a.comfort,1);assert.equal(a.structure,1);
 assert(layout.items.some(i=>i.kind==='serviceTable'));assert(layout.items.filter(i=>i.kind==='pillar').length>=3);
}
assert.throws(()=>proposals(base,undefined,()=>{throw Error('unexpected generator bug');}),/unexpected generator bug/,'programming errors must not be swallowed as infeasible layouts');
console.log('PASS: shallow U rooms, immutable and deterministic generation, unique IDs, chair pull-back, useful structures, reachable seating and exposed unexpected errors.');


const touching=[-.9,.9].map((x,n)=>({id:'legacy-'+n,kind:'dividerWall',x,z:0,rotation:0}));
assert.equal(parseDocument({version:2,...base,items:touching}).items.length,2,'old touching 1.8m wall segments remain importable');
assert.equal(dividerSpan(touching[0],touching).width,1.8);
const joint=[-.92,.92].map((x,n)=>({id:'joint-'+n,kind:'dividerWall',x,z:0,rotation:0}));
assert(Math.abs(dividerSpan(joint[0],joint).width-1.82)<1e-9,'only half the 4cm joint is closed by each neighbouring segment');
assert.equal(dividerSpan(joint[0],[joint[0],{...joint[1],z:.1}]).width,1.8,'unrelated or offset walls must not be extended');
console.log('PASS: legacy 1.8m fixed-wall footprints and bounded construction joints.');

// Supply stations must be reserved before seating exhausts wall-side pockets.
for(const {seed,outline} of [{"seed": 286850335, "outline": [{"x": 8, "z": 6.5}, {"x": 1, "z": 6.5}, {"x": 1, "z": 9.5}, {"x": -8, "z": 9.5}, {"x": -8, "z": -6.5}, {"x": -1, "z": -6.5}, {"x": -1, "z": -9.5}, {"x": 8, "z": -9.5}]}, {"seed": 1712114171, "outline": [{"x": -7, "z": -8.5}, {"x": 7, "z": -8.5}, {"x": 7, "z": 5.5}, {"x": 2, "z": 5.5}, {"x": 2, "z": 8.5}, {"x": -7, "z": 8.5}]}]){
 const layout=randomArrangement({...base,outline},rng(seed));parseDocument({version:2,...layout});
 assert(layout.items.some(i=>i.kind==='serviceTable'));assert.equal(assess(layout).blocked,0);
}
console.log('PASS: supply station and its customer approach survive dense wall rows.');

const blind={...base,items:[...[-.65,.65].flatMap((x,n)=>[-.9,.9].map((z,m)=>({id:`blind-${n}-${m}`,kind:'dividerWall',x,z,rotation:90}))),{id:'cap',kind:'dividerWall',x:0,z:-1.8,rotation:0}]};
assert(quality(blind).deadEnds>quality({...base,items:[]}).deadEnds,'unused blind passages receive a penalty, not seating access ends');
console.log('PASS: dead-end pocket ranking signal.');
