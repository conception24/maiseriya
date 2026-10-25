import {useState,useMemo} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {CATALOG,entrance,isArt,spawnPoint} from './floor-plan';
import {createNavigator} from './robot-navigation';
import type {Proposal,Feedback} from './layout-review';
export function LayoutComparison({pair,onClose,onVote}:{pair:Proposal[];onClose:()=>void;onVote:(choice:Feedback['choice'],reason:string,note:string)=>void}){
 const portals=useMemo(()=>pair.map(p=>createNavigator(p.layout.items,p.layout.outline,spawnPoint(p.layout.outline,p.layout.items))),[pair]);
 const [reason,setReason]=useState('全体の自然さ'),[note,setNote]=useState('');
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="layout-comparison"><DialogTitle>どちらがお店らしい配置ですか？</DialogTitle><DialogDescription>同じ部屋の2案です。入口から席へ入る道、席の密度、仕切りの使い方を見比べてください。</DialogDescription>
 <div className="comparison-plans">{pair.map((p,n)=>{const xs=p.layout.outline.map(q=>q.x),zs=p.layout.outline.map(q=>q.z),e=entrance(p.layout.outline);return <section key={n}><h3>{n===0?'A':'B'}案 <small>{p.assessment.seats}席・{p.assessment.tables}卓</small></h3><svg role="img" aria-label={`${n===0?'A':'B'}案の平面図`} viewBox={`${Math.min(...xs)-1} ${Math.min(...zs)-1} ${Math.max(...xs)-Math.min(...xs)+2} ${Math.max(...zs)-Math.min(...zs)+2}`}><polygon points={p.layout.outline.map(q=>`${q.x},${q.z}`).join(' ')} fill="#f1e7d1" stroke="#586d57" strokeWidth=".16"/>{p.layout.items.filter(i=>!isArt(i.kind)&&i.kind!=='robot').map(i=>{const c=CATALOG[i.kind];return <g key={i.id} transform={`translate(${i.x} ${i.z}) rotate(${i.rotation})`}><rect x={-c.w/2} y={-c.d/2} width={c.w} height={c.d} fill={i.kind==='partition'?'#764721':i.kind==='checkout'?'#527b8a':i.kind==='serviceTable'?'#ac7254':i.kind==='drinkbar'?'#b28f3b':'#668363'} stroke="#fff" strokeWidth={i.kind==='partition'?0:.06}/>{['two','four'].includes(i.kind)&&<rect x={-c.w/2+.08} y="-.35" width={c.w-.16} height=".7" fill="#d6ae76"/>}</g>;})}<circle cx={e.x} cy={e.z} r=".3" fill="#be5835"/><text x={e.x+e.nx*.8} y={e.z+e.nz*.8} textAnchor="middle" fontSize=".45">入口</text>{[...portals[n].kitchens.map(k=>({...k,label:'厨房'})),...(portals[n].restroom?[{...portals[n].restroom,label:'WC'}]:[])].map(k=><text key={k.label+k.edge} x={k.door.x+k.nx*.65} y={k.door.z+k.nz*.65} textAnchor="middle" fontSize=".4" fill="#294e60">{k.label}</text>)}</svg></section>;})}</div>
 <p>緑：席 ／ 茶色の線：木の仕切り ／ 青：レジ ／ 黄：ドリンクバー ／ 茶：調味料台</p>
 <label>判断したポイント<select value={reason} onChange={e=>setReason(e.target.value)}>{['全体の自然さ','通路の分かりやすさ','席の密度','席の整列・まとまり','壁・仕切りの使い方','席への入りやすさ'].map(r=><option key={r}>{r}</option>)}</select></label>
 <label>気になる場所・直してほしい点<textarea maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="例：Aの右奥の席は入りにくそう。Bの中央通路は自然。"/></label>
 <div className="comparison-actions"><button onClick={()=>onVote('A',reason,note)}>Aがよい・採用</button><button onClick={()=>onVote('B',reason,note)}>Bがよい・採用</button><button onClick={()=>onVote('neither',reason,note)}>どちらもよくない</button><button onClick={onClose}>評価せず閉じる</button></div>
 <p>選択はこの画面を開いている間の候補選びに反映します。コメントは書き出して共有できます。自動送信・ブラウザ保存はしません。</p>
 </DialogContent></Dialog>;
}
