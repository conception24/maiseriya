import {useId} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import type {Layout} from './floor-plan';

const chairLabels={gray:'グレー・フック付き',perforated:'グレー・丸穴',woven:'籐編み・縦模様'};
const wallLabels={wood:'木目パネル',tile:'白・緑・赤のタイル'};
type Finish=Layout['chairStyle']|NonNullable<Layout['drinkbarStyle']>;

function ChairPreview({style}:{style:Layout['chairStyle']}) {
 const pattern=useId(), woven=style.startsWith('woven');
 return <svg viewBox="0 0 144 94" aria-hidden="true">
  <defs><pattern id={pattern} width="6" height="6" patternUnits="userSpaceOnUse">
   {woven?<><rect width="6" height="6" fill="#d4af71"/><path d={'M1 0v6M4 1v4'} fill="none" stroke="#67492d" strokeWidth="1.3"/></>:<><rect width="6" height="6" fill="#79766c"/><circle cx="3" cy="3" r="1.15" fill="#ecebdc"/></>}
  </pattern></defs>
  <g fill="none" stroke={woven?'#9e6a38':'#565751'} strokeWidth="4" strokeLinecap="round"><path d="M48 57l-5 28m47-28 6 28M52 53l2 24m32-24 2 25"/></g>
  {woven?<><path d="M47 58L45 36Q40 11 66 6Q92 3 96 30L90 59" fill="none" stroke="#9e6a38" strokeWidth="6"/><path d="M50 31Q51 13 67 11Q86 9 91 29Q87 45 72 51Q56 46 50 31" fill={'url(#'+pattern+')'} stroke="#765533" strokeWidth="3"/></>:<><path d="M44 10Q71 6 97 11L92 59H87l4-24H50l3 25h-5Z" fill="#66665f"/>{style==='perforated'?<path d="M47 13Q71 9 94 14L91 38Q68 32 50 38Z" fill={'url(#'+pattern+')'}/>:<><rect x="48" y="16" width="42" height="22" fill="#eef0e5"/><path d="M60 14h22l-2 40H59Z" fill="#66665f"/><path d="M65 17h11v5h-4v-2h-3v2h-4Z" fill="#eef0e5"/></>}</>}
  <path d="M48 52Q70 49 90 53l7 8Q78 69 43 64Z" fill={woven?'#234c40':'#858279'} stroke={woven?'#916638':'#66665f'} strokeWidth="2"/>
 </svg>;
}
function WallPreview({style}:{style:'wood'|'tile'}) {
 const grid=useId(), wood=style==='wood';
 return <svg viewBox="0 0 144 94" aria-hidden="true">
  <defs><pattern id={grid} width={wood?48:9} height={wood?21:9} patternUnits="userSpaceOnUse"><rect width="100%" height="100%" fill={wood?'#9d714d':'#f5f0df'}/>{wood?<><path d="M0 3q17 3 48 0m-48 5q23-2 48 0m-48 6q20 3 48-1" fill="none" stroke="#835c40"/><text x="24" y="12" textAnchor="middle" fontSize="4" fill="#684831">VINO</text></>:null}<path d={wood?'M0 0h48v21':'M0 0h9v9'} fill="none" stroke={wood?'#d3a573':'#cdc9ba'}/></pattern></defs>
  <rect x="3" y="3" width="138" height="85" rx="2" fill={'url(#'+grid+')'}/>
  {!wood&&<g transform="translate(72 59) rotate(45)">{Array.from({length:16},(_,i)=><rect key={i} x={i%4*8-16} y={Math.floor(i/4)*8-16} width="8" height="8" fill={(i%4<2)===(i<8)?'#ae3740':'#38604a'} stroke="#ede9da"/>)}</g>}
  <text x="72" y={wood?52:34} textAnchor="middle" fontFamily="Georgia,serif" fontSize={wood?19:16} fill={wood?'#fff0ca':'#645745'}>{wood?'DRINK BAR':'Drink Bar'}</text>
 </svg>;
}
export function FinishPicker({kind,layout,onPick,onClose}:{kind:'chair'|'wall';layout:Layout;onPick:(patch:Partial<Layout>)=>void;onClose:()=>void}) {
 const chair=kind==='chair';
 const choices=Object.entries(chair?chairLabels:wallLabels) as [Finish,string][];
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="finish-dialog">
  <DialogTitle>{chair?'椅子のタイプ':'ドリンクバーの壁'}</DialogTitle>
  <DialogDescription>使いたいデザインを選んでください。</DialogDescription>
  <div className="finish-options">{choices.map(([key,label])=>{
   const selected=key===(chair?layout.chairStyle:layout.drinkbarStyle??'wood');
   return <button key={key} aria-pressed={selected} onClick={()=>{onPick(chair?{chairStyle:key as Layout['chairStyle']}:{drinkbarStyle:key as Layout['drinkbarStyle']});onClose();}}>
    {chair?<ChairPreview style={key as Layout['chairStyle']}/>:<WallPreview style={key as 'wood'|'tile'}/>}<span>{label}</span>
   </button>;
  })}</div>
 </DialogContent></Dialog>;
}
