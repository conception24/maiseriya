import {randomRoom} from './random-layout';
import {proposals,type Preferences} from './layout-review';
import type {Layout} from './floor-plan';
self.onmessage=(event:MessageEvent<{layout:Layout;room:boolean;review?:boolean;preferences?:Preferences}>)=>{
 try{const {layout,room,review,preferences}=event.data;
 const candidates=proposals(room?{...layout,outline:randomRoom(),drinkbarStyle:Math.random()<.5?'wood':'tile'}:layout,preferences);
 if(!candidates.length)throw Error();
 self.postMessage(review?{proposal:candidates[0]}:{layout:candidates[0].layout});}
 catch{self.postMessage({error:'通路と席を確保できませんでした。部屋を広げるか、もう一度お試しください。'});}
};
