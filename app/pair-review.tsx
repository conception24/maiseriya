import {useEffect,useMemo,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Furniture} from './furniture-glyph';
import {entrance,spawnPoint,isArt,type Layout} from './floor-plan';
import {createNavigator} from './robot-navigation';
import {continuousBenches} from './seating-rules';
import {PLANNER_VERSION,type LayoutPair,type PairAnswer} from './pair-review-model';
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
 const [ready,setReady]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[view,setView]=useState<'plan'|'A'|'B'>('plan');
 const lastAnswer=useRef(0);
 const session=useRef<{source:Layout;worker:Worker|null;next:LayoutPair|null;current:LayoutPair|null;answered:boolean;seed:number}|null>(null);
 const refill=()=>{
  const s=session.current;if(!s||s.worker||s.next)return;
  const worker=new PairWorker();s.worker=worker;setLoading(true);setError('');
  const fail=(message:string)=>{worker.terminate();if(session.current!==s)return;s.worker=null;setLoading(false);setError(message);};
  worker.onmessage=(event:MessageEvent<{pair?:LayoutPair;error?:string}>)=>{
   worker.terminate();if(session.current!==s)return;s.worker=null;setLoading(false);
   if(!event.data.pair){setError(event.data.error??'生成できませんでした');return;}
   if(!s.current){s.current=event.data.pair;s.answered=false;setPair(s.current);setNote('');setView('plan');refill();}
   else{s.next=event.data.pair;setReady(true);}
  };
  worker.onerror=()=>fail('生成を中断しました。再試行してください。');
  worker.postMessage({layout:s.source,seed:s.seed});s.seed=(s.seed+1000003)%2147483646;
 };
 useEffect(()=>{
  if(!open)return;
  const s={source:structuredClone(layout),worker:null,next:null,current:null,answered:false,seed:Math.floor(Math.random()*2147483645)+1};
  session.current=s;setPair(null);setReady(false);setNote('');setView('plan');refill();
  return()=>{session.current?.worker?.terminate();session.current=null;};
  // The chosen room is frozen for this comparison session, including during prefetch.
 },[open]);
 const answer=(choice:PairAnswer['choice'])=>{
  const s=session.current;if(!s?.current||s.answered||performance.now()-lastAnswer.current<400)return;s.answered=true;lastAnswer.current=performance.now();
  const record:PairAnswer={pair:s.current,choice,note:note.trim(),view,at:new Date().toISOString()};
  setRecords(r=>[...r,record]);s.current=s.next;s.next=null;s.answered=false;setPair(s.current);setReady(false);setNote('');setView('plan');refill();
 };
 const save=()=>{const blob=new Blob([JSON.stringify({format:'saize-pair-feedback',version:1,plannerVersion:PLANNER_VERSION,records},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='saize-ab-feedback.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <Dialog open={open} onOpenChange={v=>{if(!v)onClose();}}><DialogContent className="layout-comparison pair-review"><DialogTitle>どちらの配置が自然ですか？</DialogTitle><DialogDescription>同じ部屋の２案です。A・B・どちらもダメを選ぶと、すぐ次へ進みます。理由は任意です。</DialogDescription>
  <p role="status">{records.length}問回答済み ／ {ready?'次の２案を準備済み':loading?'次の２案を先に生成中…':'生成待ち'}</p>
  {pair?<><div className="pair-view-buttons"><button aria-pressed={view==='plan'} onClick={()=>setView('plan')}>平面図で比較</button><button aria-pressed={view==='A'} onClick={()=>setView('A')}>Aを3Dで見る</button><button aria-pressed={view==='B'} onClick={()=>setView('B')}>Bを3Dで見る</button></div>
   {view==='plan'?<div className="comparison-plans">{pair.candidates.map((p,n)=><section key={n}><h3>{n===0?'A':'B'} <small>{p.assessment.seats}席・{p.assessment.tables}卓</small></h3><Plan layout={p.layout} label={n===0?'A':'B'}/></section>)}</div>:<PairWalk key={pair.id+view} layout={pair.candidates[view==='A'?0:1].layout}/>}
   <label>理由・気になる場所（任意）<input maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="例：Aは長椅子が続いている。Bは右下が空きすぎ"/></label>
   <div className="comparison-actions pair-vote"><button onClick={()=>answer('A')}>Aの方がよい</button><button onClick={()=>answer('B')}>Bの方がよい</button><button onClick={()=>answer('neither')}>どちらもダメ</button></div>
  </>:<p role="status">{error?'２案を用意できませんでした。':'比較する２案を生成しています…'} 回答済みの結果は保持しています。</p>}
  {error&&<p role="alert">{error} <button onClick={refill}>再試行</button></p>}
  <div className="comparison-actions"><button disabled={!records.length} onClick={save}>評価結果を保存（{records.length}問）</button><button onClick={onClose}>閉じる</button></div>
  <p>回答・両方の配置・乱数・生成時間を記録します。保存したファイルを共有すると、配置ルールの改善に使えます。自動学習や自動送信はしません。ページを閉じる前に保存してください。</p>
 </DialogContent></Dialog>;
}
