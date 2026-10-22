import {randomArrangement,randomRoom} from './random-layout';
import type {Layout} from './floor-plan';
self.onmessage=(event:MessageEvent<{layout:Layout;room:boolean}>)=>{
 try{const {layout,room}=event.data;self.postMessage({layout:randomArrangement(room?{...layout,outline:randomRoom()}:layout)});}
 catch{self.postMessage({error:'配置を生成できませんでした。もう一度お試しください。'});}
};
