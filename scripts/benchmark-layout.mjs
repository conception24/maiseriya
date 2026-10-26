import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {initialLayout,parseDocument} from '../work/model-test/floor-plan.mjs';
import {randomRoom,randomArrangement} from '../work/model-test/random-layout.mjs';
import {assess,proposals} from '../work/model-test/layout-review.mjs';
const argument=name=>{const n=process.argv.indexOf(name);return n<0?null:process.argv[n+1];};
const beforePath=argument('--before');
const ranked=process.argv.includes('--ranked');
const previous=beforePath?await import(pathToFileURL(path.resolve(beforePath,ranked?'layout-review.mjs':'random-layout.mjs'))):null;
const generate=ranked?(source,random)=>proposals(source,undefined,random)[0].layout:randomArrangement;
const beforeGenerate=previous?(ranked?(source,random)=>previous.proposals(source,undefined,random)[0].layout:previous.randomArrangement):null;
const rng=seed=>()=>((seed=seed*16807%2147483647)-1)/2147483646;
const cases=[];
for(let shape=-1;shape<17;shape++)for(const seed of[21,137]){
 if(ranked&&(seed!==21||![-1,1,3,5,6,16].includes(shape)))continue;
 let call=0;const roll=shape===16?.99:(shape+.5)*.98/16;
 const source={...initialLayout(),...(shape<0?{}:{outline:randomRoom(()=>[.4,.4,roll,.8][call++])})};
 cases.push({shape,seed,source});
}
// Warm both implementations before interleaved measurements. Evaluate quality
// outside the timed generation, using exactly the same evaluator for both plans.
generate(cases[0].source,rng(7));beforeGenerate?.(cases[0].source,rng(7));
const results=[];
for(const [index,c] of cases.entries()){
 const result={shape:c.shape,seed:c.seed};
 const generators=[['after',generate],...(beforeGenerate?[['before',beforeGenerate]]:[])];
 if(index%2)generators.reverse();
 for(const [key,generate] of generators){
  const start=performance.now(),layout=generate(c.source,rng(c.seed));result[key+'Ms']=performance.now()-start;
  if(key==='after')parseDocument({version:2,...layout});
  result[key]={layout,assessment:assess(layout)};
 }
 results.push(result);
}
const mean=values=>values.reduce((s,n)=>s+n,0)/values.length;
for(const key of['before','after'])if(results[0][key]){
 console.log(key,JSON.stringify({meanMs:mean(results.map(c=>c[key+'Ms'])),maxMs:Math.max(...results.map(c=>c[key+'Ms'])),...Object.fromEntries(['seats','blocked','comfort','structure','order','coverage','circulation','deadEnds','waste','usableEmptyRadius'].map(m=>[m,mean(results.map(c=>c[key].assessment[m]))]))}));
}
if(argument('--out'))fs.writeFileSync(argument('--out'),JSON.stringify({version:1,ranked,cases:results},null,2));
