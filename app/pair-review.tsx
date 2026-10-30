import {useEffect,useMemo,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Furniture} from './furniture-glyph';
import {entrance,spawnPoint,isArt,type Layout} from './floor-plan';
import {createNavigator} from './robot-navigation';
import {continuousBenches} from './seating-rules';
import {feedbackDocument,type LayoutPair,type PairAnswer,type PairRoomMode} from './pair-review-model';
import {PairPrefetch,type PairQueueStatus} from './pair-prefetch';
import PairWorker from './pair-worker?worker&inline';

function Plan({layout,label}:{layout:Layout;label:string}){
 const nav=useMemo(()=>createNavigator(layout.items,layout.outline,spawnPoint(layout.outline,layout.items),{services:false}),[layout]);
 const runs=useMemo(()=>continuousBenches(layout.items),[layout]);
 const xs=layout.outline.map(p=>p.x),zs=layout.outline.map(p=>p.z),entry=entrance(layout.outline);
 return <svg role="img" aria-label={`${label}の平面図`} viewBox={`${Math.min(...xs)-.5} ${Math.min(...zs)-.5} ${Math.max(...xs)-Math.min(...xs)+1} ${Math.max(...zs)-Math.min(...zs)+1}`}>
  <polygon points={layout.outline.map(p=>`${p.x},${p.z}`).join(' ')} fill="#f1e7d1" stroke="#586d57" strokeWidth=".16"/>
  {layout.items.filter(i=>!isArt(i.kind)&&!['robot','bench'].includes(i.kind)).map(i=><g key={i.id} transform={`translate(${i.x} ${i.z}) rotate(${i.rotation})`}><Furniture kind={i.kind}/></g>)}
  {runs.map(run=><g key={run[0].id} transform={`translate(${run.reduce((s,i)=>s+i.x,0)/run.length} ${run.reduce((s,i)=>s+i.z,0)/run.length}) rotate(${run[0].rotation})`}><Furniture kind="bench" length={run.length*1.84}/></g>)}
  <circle cx={entry.x} cy={entry.z} r=".25" fill="#bd5533"/><text x={entry.x+entry.nx*.55} y={entry.z+entry.nz*.55} textAnchor="middle" fontSize=".38">入口</text>
  {[...nav.kitchens.map(k=>({...k,label:'厨房'})),...(nav.restroom?[{...nav.restroom,label:'WC'}]:[])].map(k=><text key={k.label+k.edge} x={k.door.x+k.nx*.5} y={k.door.z+k.nz*.5} textAnchor="middle" fontSize=".4" fill="#163d45">{k.label}</text>)}
 </svg>;
}
function PairWalk({layout}:{layout:Layout}){
 const host=useRef<HTMLDivElement>(null),[error,setError]=useState('');
 useEffect(()=>{let cancelled=false,dispose:(()=>void)|undefined;
  import('./room').then(({createRoom})=>{if(cancelled||!host.current)return;const api=createRoom(host.current,layout.items,()=>{},{outline:layout.outline,chairStyle:layout.chairStyle,foodEnabled:layout.foodEnabled,drinkbarStyle:layout.drinkbarStyle,invertX:layout.invertX,invertY:layout.invertY});dispose=()=>api.dispose();}).catch(()=>{if(!cancelled)setError('3Dを表示できませんでした。平面図で比較できます。');});
  return()=>{cancelled=true;dispose?.();};
 },[layout]);
 return <><p>ドラッグで見回す・WASD / 矢印キーで歩く</p><div className="pair-walk" ref={host}/>{error&&<p role="alert">{error}</p>}</>;
}
export function PairReview({open,layout,onClose}:{open:boolean;layout:Layout;onClose:()=>void}){
 const [pair,setPair]=useState<LayoutPair|null>(null),[records,setRecords]=useState<PairAnswer[]>([]),[note,setNote]=useState('');
 const [mode,setMode]=useState<PairRoomMode>('varied'),[waiting,setWaiting]=useState(true),[error,setError]=useState('');
 const [status,setStatus]=useState<PairQueueStatus>({ready:0,loading:false,error:''}),[view,setView]=useState<'plan'|'A'|'B'>('plan');
 const [saved,setSaved]=useState(0);
 const session=useRef<{queue:PairPrefetch;current:LayoutPair|null}|null>(null);
 const advance=async(s:NonNullable<typeof session.current>)=>{
  setWaiting(true);setError('');
  try{const next=await s.queue.take();if(session.current!==s)return;s.current=next;setPair(next);setNote('');setView('plan');}
  catch(error){if(session.current===s)setError(error instanceof Error?error.message:'次の問題を用意できませんでした。');}
  finally{if(session.current===s)setWaiting(false);}
 };
 useEffect(()=>{
  if(!open)return;
  const source=structuredClone(layout);let seed=Math.floor(Math.random()*2147483645)+1;
  const queue=new PairPrefetch(()=>{
   const worker=new PairWorker();let rejectRequest:(error:Error)=>void=()=>{},timeout:ReturnType<typeof setTimeout>;
   const stop=()=>{clearTimeout(timeout);worker.terminate();};
   const promise=new Promise<LayoutPair>((resolve,reject)=>{
    rejectRequest=reject;
    timeout=setTimeout(()=>{stop();reject(Error('生成に時間がかかっています。別の候補を試します。'));},30000);
    worker.onmessage=(event:MessageEvent<{pair?:LayoutPair;error?:string}>)=>{stop();if(event.data.pair)resolve(event.data.pair);else reject(Error(event.data.error??'２案を作れませんでした。'));};
    worker.onerror=()=>{stop();reject(Error('生成を中断しました。'));};
    try{worker.postMessage({layout:source,seed,mode});seed=(seed+1000003)%2147483646+1;}catch(error){stop();reject(error);}
   });
   return{promise,cancel:()=>{stop();rejectRequest(Error('比較を終了しました'));}};
  },setStatus);
  const s={queue,current:null};session.current=s;setPair(null);setNote('');setView('plan');void advance(s);
  return()=>{queue.dispose();if(session.current===s)session.current=null;};
  // Keep the source frozen until the dialog or room mode changes.
 },[open,mode]);
 const answer=(choice:PairAnswer['choice'],id:string)=>{
  const s=session.current;if(!s?.current||s.current.id!==id)return;
  const record:PairAnswer={pair:s.current,choice,note:note.trim(),view,at:new Date().toISOString()};
  s.current=null;setRecords(r=>[...r,record]);void advance(s);
 };
 const save=()=>{const blob=new Blob([JSON.stringify(feedbackDocument(records),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='saize-ab-feedback.json';a.click();setSaved(records.length);setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <Dialog open={open} onOpenChange={v=>{if(!v)onClose();}}><DialogContent className="layout-comparison pair-review"><DialogTitle>どちらの配置が自然ですか？</DialogTitle><DialogDescription>回答をクリックするだけで次の問題へ。ダウンロードは最後に全回答をまとめて１回でできます。</DialogDescription>
  <label className="pair-room-mode">部屋の形<select value={mode} onChange={e=>setMode(e.target.value as PairRoomMode)}><option value="varied">問題ごとに自動で変える</option><option value="fixed">現在の部屋の形で続ける</option></select></label>
  <p role="status">第{records.length+1}問 · {records.length}問回答済み ／ 次の問題：{status.ready}問準備済み{status.loading?'・先読み中…':''}。１問のA・Bは同じ部屋です。</p>
  <div className="pair-stage" aria-busy={waiting}>
  {pair?<><div className="pair-view-buttons"><button aria-pressed={view==='plan'} onClick={()=>setView('plan')}>平面図で比較</button><button aria-pressed={view==='A'} onClick={()=>setView('A')}>Aを3Dで見る</button><button aria-pressed={view==='B'} onClick={()=>setView('B')}>Bを3Dで見る</button></div>
   {view==='plan'?<div className="comparison-plans">{pair.candidates.map((p,n)=><section key={n}><h3>{n===0?'A':'B'} <small>{p.assessment.seats}席・{p.assessment.tables}卓</small></h3><Plan layout={p.layout} label={n===0?'A':'B'}/></section>)}</div>:<PairWalk key={pair.id+view} layout={pair.candidates[view==='A'?0:1].layout}/>}
  </>:<div className="pair-empty">比較する２案を生成しています…</div>}
  {waiting&&<div className="pair-loading" role="status">{records.length?'回答を記録しました。':''}次の２案を準備中…</div>}
  </div>
  <label>理由・気になる場所（任意）<input disabled={waiting||!pair} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="例：Aは長椅子が続いている。Bは右下が空きすぎ"/></label>
  <div className="comparison-actions pair-vote"><button disabled={waiting||!session.current?.current} onClick={()=>pair&&answer('A',pair.id)}>Aの方がよい → 次へ</button><button disabled={waiting||!session.current?.current} onClick={()=>pair&&answer('B',pair.id)}>Bの方がよい → 次へ</button><button disabled={waiting||!session.current?.current} onClick={()=>pair&&answer('neither',pair.id)}>どちらもダメ → 次へ</button></div>
  {error&&<p role="alert">次の問題を準備できませんでした。回答済みの結果は保持しています。<button disabled={waiting} onClick={()=>session.current&&void advance(session.current)}>ここで再試行</button></p>}
  <div className="comparison-actions"><button disabled={!records.length} onClick={save}>全{records.length}問をまとめてダウンロード</button><button onClick={onClose}>いったん閉じる</button></div>
  <p>{records.length>saved?`未ダウンロード：${records.length-saved}問。`:''}閉じてもこのページ内の回答は残ります。ページを閉じる・再読み込みする前にまとめてダウンロードしてください。自動送信・自動学習はしません。</p>
 </DialogContent></Dialog>;
}
