import {preferenceScore,type Preferences,type Proposal} from './layout-review';
export type CandidateRequest={promise:Promise<Proposal[]>;cancel:()=>void};
export type PrefetchStatus={ready:number;loading:boolean};
// Keep one small batch in memory and one worker at most. Re-rank cached plans
// after each answer, so background generation does not discard new preferences.
export class ReviewPrefetch{
 private candidates:Proposal[]=[];
 private pending:Promise<void>|null=null;
 private cancel:(()=>void)|null=null;
 private disposed=false;
 constructor(private load:()=>CandidateRequest,private onStatus:(s:PrefetchStatus)=>void=()=>{}){}
 private report(){if(!this.disposed)this.onStatus({ready:this.candidates.length,loading:!!this.pending});}
 prepare():Promise<void>{
  if(this.disposed)return Promise.resolve();
  if(this.pending)return this.pending;
  if(this.candidates.length>1)return Promise.resolve();
  const request=this.load();this.cancel=request.cancel;
  this.pending=request.promise.then(candidates=>{if(!this.disposed)this.candidates.push(...candidates);}).finally(()=>{this.pending=null;this.cancel=null;this.report();});
  this.report();return this.pending;
 }
 async take(weights:Preferences):Promise<Proposal>{
  if(!this.candidates.length)await this.prepare();
  if(this.disposed)throw Error('Review closed');
  this.candidates.sort((a,b)=>preferenceScore(b.assessment,weights)-preferenceScore(a.assessment,weights));
  const next=this.candidates.shift();if(!next)throw Error('No valid layout');
  this.report();void this.prepare().catch(()=>{});
  return{...next,assessment:{...next.assessment,score:preferenceScore(next.assessment,weights)}};
 }
 dispose(){this.disposed=true;this.candidates=[];this.cancel?.();this.cancel=null;}
}
