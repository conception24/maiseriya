import {generatePair} from './pair-review-model';
import type {Layout} from './floor-plan';
self.onmessage=(event:MessageEvent<{layout:Layout;seed:number}>)=>{
 try{self.postMessage({pair:generatePair(event.data.layout,event.data.seed)});}
 catch(error){self.postMessage({error:error instanceof Error?error.message:'候補を生成できませんでした。'});}
};
