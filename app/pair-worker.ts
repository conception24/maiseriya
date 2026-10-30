import {generateReviewPair,type PairRoomMode} from './pair-review-model';
import type {Layout} from './floor-plan';
self.onmessage=(event:MessageEvent<{layout:Layout;seed:number;mode:PairRoomMode}>)=>{
 try{self.postMessage({pair:generateReviewPair(event.data.layout,event.data.seed,event.data.mode)});}
 catch(error){self.postMessage({error:error instanceof Error?error.message:'候補を生成できませんでした。'});}
};
