import type {LayoutPair} from './pair-review-model';
export type PairQueueStatus={ready:number;loading:boolean;error:string};
export type PairRequest={promise:Promise<LayoutPair>;cancel:()=>void};

// Two upcoming questions, at most one worker, bounded automatic retries.
export class PairPrefetch{
 private queue:LayoutPair[]=[];
 private pending:Promise<void>|null=null;
 private cancel:(()=>void)|null=null;
 private disposed=false;
 private error='';
 constructor(private load:()=>PairRequest,private changed:(status:PairQueueStatus)=>void=()=>{}){}
 private report(){if(!this.disposed)this.changed({ready:this.queue.length,loading:!!this.pending,error:this.error});}
 prepare():Promise<void>{
  if(this.disposed||this.queue.length>=2)return Promise.resolve();
  if(this.pending)return this.pending;
  this.error='';
  this.pending=(async()=>{
   for(let attempt=0;attempt<3&&!this.disposed;attempt++){
    try{
     const request=this.load();this.cancel=request.cancel;
     const pair=await request.promise;
     if(!this.disposed)this.queue.push(pair);
     return;
    }catch(error){if(attempt===2&&!this.disposed)this.error=error instanceof Error?error.message:'次の問題を作れませんでした。';}
    finally{this.cancel=null;}
   }
  })().finally(()=>{this.pending=null;this.report();if(!this.disposed&&!this.error&&this.queue.length<2)void this.prepare();});
  this.report();return this.pending;
 }
 async take():Promise<LayoutPair>{
  if(!this.queue.length)await this.prepare();
  if(this.disposed)throw Error('比較を終了しました');
  const pair=this.queue.shift();
  if(!pair)throw Error(this.error||'次の問題を作れませんでした。');
  this.report();void this.prepare();return pair;
 }
 dispose(){this.disposed=true;this.queue=[];this.cancel?.();}
}
