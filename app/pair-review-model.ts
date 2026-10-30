import {LayoutPlanningError} from './dining-planner';
import {randomArrangement} from './random-layout';
import {assess,type Proposal} from './layout-review';
import {isArt,type Layout} from './floor-plan';

export const PLANNER_VERSION='2026-10-30-continuous-wall-v1';
export type PairCandidate=Proposal&{seed:number;generationMs:number};
export type LayoutPair={id:string;version:string;candidates:[PairCandidate,PairCandidate]};
export type PairAnswer={pair:LayoutPair;choice:'A'|'B'|'neither';note:string;at:string;view:'plan'|'A'|'B'};
export const seededRandom=(seed:number)=>()=>((seed=seed*16807%2147483647)-1)/2147483646;
export function layoutFingerprint(layout:Layout){return JSON.stringify(layout.items.filter(i=>!isArt(i.kind)&&!['robot','plant'].includes(i.kind)).map(({kind,x,z,rotation})=>[kind,x,z,rotation]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));}
export function generatePair(source:Layout,seed:number):LayoutPair{
 const candidates:PairCandidate[]=[];
 for(let attempt=0;attempt<10&&candidates.length<2;attempt++){
  const candidateSeed=(seed+attempt*104729)%2147483646+1,start=performance.now();
  try{
   const layout=randomArrangement(source,seededRandom(candidateSeed)),assessment=assess(layout);
   if(assessment.blocked||!assessment.tables||candidates.some(c=>layoutFingerprint(c.layout)===layoutFingerprint(layout)))continue;
   candidates.push({layout,assessment,seed:candidateSeed,generationMs:performance.now()-start});
  }catch(error){if(!(error instanceof LayoutPlanningError))throw error;}
 }
 if(candidates.length<2)throw new LayoutPlanningError('比較できる２案を確保できませんでした。再試行するか部屋を広げてください。');
 return{id:`${PLANNER_VERSION}-${seed}`,version:PLANNER_VERSION,candidates:candidates as LayoutPair['candidates']};
}
