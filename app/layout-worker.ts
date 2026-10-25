import {randomRoom} from './random-layout';
import {proposals,type Preferences} from './layout-review';
import type {Layout} from './floor-plan';
self.onmessage=(event:MessageEvent<{layout:Layout;room:boolean;compare?:boolean;preferences?:Preferences}>)=>{
 try{const {layout,room,compare,preferences}=event.data;const candidates=proposals(room?{...layout,outline:randomRoom(),drinkbarStyle:Math.random()<.5?'wood':'tile'}:layout,preferences);
 if(!candidates.length)throw Error();
 const best=candidates[0];
 const difference=(p:typeof best)=>['density','order','coverage','wall'].reduce((sum,key)=>sum+Math.abs(p.assessment[key as 'density']-best.assessment[key as 'density']),0);
 const alternative=candidates.slice(1).sort((a,b)=>difference(b)-difference(a))[0];
 if(compare&&!alternative)throw Error();
 self.postMessage(compare&&alternative?{proposals:[best,alternative]}:{layout:best.layout});}
 catch{self.postMessage({error:'通路と席を確保できませんでした。部屋を広げるか、もう一度お試しください。'});}
};
