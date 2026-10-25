import {useState,useMemo,useRef,useEffect} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {CATALOG,entrance,isArt,spawnPoint} from './floor-plan';
import {createNavigator} from './robot-navigation';
import {ISSUE_OPTIONS,type Proposal,type AnswerId} from './layout-review';
export function LayoutQuestion({proposal,busy,count,lastAnswer,customOptions,onClose,onAnswer,onAdopt}:{proposal:Proposal;busy:boolean;count:number;lastAnswer:string;customOptions:string[];onClose:()=>void;onAnswer:(answer:AnswerId,note:string,customLabel?:string,addOption?:boolean)=>void;onAdopt:()=>void}){
 const portals=useMemo(()=>[createNavigator(proposal.layout.items,proposal.layout.outline,spawnPoint(proposal.layout.outline,proposal.layout.items))],[proposal]);
 const answersRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{answersRef.current?.scrollTo({top:0});},[proposal]);
 const [note,setNote]=useState(''),[customLabel,setCustomLabel]=useState(''),[addOption,setAddOption]=useState(false);
 const answer=(id:AnswerId,label?:string,add=false)=>{onAnswer(id,note,label,add);setNote('');setCustomLabel('');setAddOption(false);};
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="layout-comparison layout-question"><DialogTitle>この配置で、一番気になる問題は？</DialogTitle><DialogDescription>1案につき1回答です。問題点を1つクリックすると、記録して次の配置へ進みます。</DialogDescription>
 <p className="question-progress" role="status">{count}件回答済み{lastAnswer&&` ／ 前の回答：${lastAnswer}`}</p>
 <div className="question-body"><div>
 <div className="comparison-plans">{[proposal].map((p,n)=>{const xs=p.layout.outline.map(q=>q.x),zs=p.layout.outline.map(q=>q.z),e=entrance(p.layout.outline);return <section key={n}><h3>配置 <small>{p.assessment.seats}席・{p.assessment.tables}卓</small></h3><svg role="img" aria-label={'評価する配置の平面図'} viewBox={`${Math.min(...xs)-1} ${Math.min(...zs)-1} ${Math.max(...xs)-Math.min(...xs)+2} ${Math.max(...zs)-Math.min(...zs)+2}`}><polygon points={p.layout.outline.map(q=>`${q.x},${q.z}`).join(' ')} fill="#f1e7d1" stroke="#586d57" strokeWidth=".16"/>{p.layout.items.filter(i=>!isArt(i.kind)&&i.kind!=='robot').map(i=>{const c=CATALOG[i.kind];return <g key={i.id} transform={`translate(${i.x} ${i.z}) rotate(${i.rotation})`}><rect x={-c.w/2} y={-c.d/2} width={c.w} height={c.d} fill={i.kind==='partition'?'#764721':i.kind==='checkout'?'#527b8a':i.kind==='serviceTable'?'#ac7254':i.kind==='drinkbar'?'#b28f3b':'#668363'} stroke="#fff" strokeWidth={i.kind==='partition'?0:.06}/>{['two','four'].includes(i.kind)&&<rect x={-c.w/2+.08} y="-.35" width={c.w-.16} height=".7" fill="#d6ae76"/>}</g>;})}<circle cx={e.x} cy={e.z} r=".3" fill="#be5835"/><text x={e.x+e.nx*.8} y={e.z+e.nz*.8} textAnchor="middle" fontSize=".45">入口</text>{[...portals[n].kitchens.map(k=>({...k,label:'厨房'})),...(portals[n].restroom?[{...portals[n].restroom,label:'WC'}]:[])].map(k=><text key={k.label+k.edge} x={k.door.x+k.nx*.65} y={k.door.z+k.nz*.65} textAnchor="middle" fontSize=".4" fill="#294e60">{k.label}</text>)}</svg></section>;})}</div>
 <p>緑：席 ／ 茶色の線：追加壁・仕切り ／ 青：レジ ／ 黄：ドリンクバー ／ 茶：調味料台</p>
 </div><div ref={answersRef} className="question-answers" aria-busy={busy}>
 <label>補足（任意・選ぶ前に入力）<textarea disabled={busy} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="例：左奥の仕切りで席に入れない"/></label>
 <div className="issue-options">{ISSUE_OPTIONS.map((o,n)=><button disabled={busy} key={o.id} onClick={()=>answer(o.id)}><span>{n+1}</span>{o.label}</button>)}{customOptions.map(label=><button disabled={busy} key={label} onClick={()=>answer('other',label)}><span>追加</span>{label}</button>)}</div>
 <div className="custom-answer"><label>その他・自由記入<input disabled={busy} maxLength={120} value={customLabel} onChange={e=>setCustomLabel(e.target.value)} placeholder="用意された選択肢にない問題点"/></label><label className="add-option"><input type="checkbox" disabled={busy} checked={addOption} onChange={e=>setAddOption(e.target.checked)}/>次の質問から選択肢に追加</label><button disabled={busy||!customLabel.trim()} onClick={()=>answer('other',customLabel.trim(),addOption)}>自由記入で回答して次へ</button></div>
 <div className="question-extra"><button disabled={busy} onClick={()=>answer('good')}>問題なし・自然な配置</button><button disabled={busy} onClick={()=>answer('unsure')}>判断できない</button></div>
 </div></div>
 {busy&&<p role="status">次の配置を考えています…</p>}
 <div className="comparison-actions"><button disabled={busy} onClick={onAdopt}>この配置を採用して閉じる</button><button onClick={onClose}>評価を終了</button></div>
 <p>回答はこの画面を開いている間だけ保持します。「評価を書き出す」で配置と回答をまとめて共有できます。密度・壁の量などは次の候補選びに反映し、その他の問題点は改善用に記録します。</p>
 </DialogContent></Dialog>;
}
