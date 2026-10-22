import {DEFAULT_OUTLINE,edges,entrance,rectInRoom,circleClear,outlineError,intersects,type Point} from './geometry';
export {DEFAULT_OUTLINE,edges,entrance,outlineError,area,inside,type Point} from './geometry';
export type Kind = 'two' | 'four' | 'table' | 'wideTable' | 'chair' | 'bench' | 'partition' | 'plant' | 'venus' | 'primavera' | 'cherubs' | 'robot' | 'adam' | 'annunciation' | 'athens' | 'logo' | 'checkout';
export type Item = {id:string;kind:Kind;x:number;z:number;rotation:number;side?:'inside'|'outside'};
export type Layout={items:Item[];outline:Point[];chairStyle:'woven'|'gray'|'perforated';foodEnabled?:boolean;invertX?:boolean;invertY?:boolean};
export const isArt=(kind:Kind)=>['venus','primavera','cherubs','adam','annunciation','athens','logo'].includes(kind);
export type Rect = {x:number;z:number;w:number;d:number;rotation:number};
export const CATALOG:Record<Kind,{name:string;description:string;w:number;d:number;seats:number}>={
 two:{name:'2人席セット',description:'テーブル＋切替式チェア2脚',w:.86,d:1.95,seats:2},
 four:{name:'4人席セット',description:'テーブル＋クッション席2台',w:1.84,d:2.22,seats:4},
 table:{name:'小さなテーブル',description:'2人用・木目の天板',w:.82,d:.78,seats:0},
 wideTable:{name:'大きなテーブル',description:'4人用・木目の天板',w:1.53,d:.8,seats:0},
 chair:{name:'椅子',description:'籐編み / グレー2種類',w:.49,d:.5,seats:1},
 bench:{name:'クッション席',description:'2人掛けのベンチ',w:1.84,d:.66,seats:2},
 partition:{name:'木の仕切り',description:'薄い板・丸い上角',w:1.8,d:.036,seats:0},
 venus:{name:'ヴィーナスの誕生',description:'ボッティチェリ / 壁に配置',w:2,d:.12,seats:0},
 primavera:{name:'春（プリマヴェーラ）',description:'ボッティチェリ / 壁に配置',w:2,d:.12,seats:0},
 cherubs:{name:'二人の天使',description:'ラファエロ / 壁に配置',w:1.6,d:.12,seats:0},
 adam:{name:'アダムの創造',description:'ミケランジェロ / 壁に配置',w:2.2,d:.12,seats:0},
 annunciation:{name:'受胎告知',description:'レオナルド / 壁に配置',w:2,d:.12,seats:0},
 athens:{name:'アテナイの学堂',description:'ラファエロ / 壁に配置',w:2,d:.12,seats:0},
 logo:{name:'サイゼリヤのロゴ',description:'入口付近の壁用パネル',w:1.35,d:.12,seats:0},
 robot:{name:'配膳ロボット Servi',description:'最大5台。料理を配膳・回収して厨房へ',w:.49,d:.49,seats:0},
 checkout:{name:'セルフレジ',description:'モニター・現金精算機・バーコード読取機',w:1.3,d:.7,seats:0},
 plant:{name:'観葉植物',description:'通路に緑を添える',w:.65,d:.65,seats:0}
};
export const snap=(n:number)=>Math.round(n*4)/4;
export function bounds(item:Item):Rect {const s=CATALOG[item.kind];return {x:item.x,z:item.z,w:s.w,d:s.d,rotation:item.rotation};}
export function dimensions(r:Rect){return r.rotation%180===0?{w:r.w,d:r.d}:{w:r.d,d:r.w};}
export function snapArt(item:Item,polygon:Point[]):Item{if(!isArt(item.kind))return item;const half=CATALOG[item.kind].w/2+.12,valid=edges(polygon).filter(e=>e.length>=half*2);if(!valid.length)return item;const choices=valid.map(e=>{const t=Math.max(half,Math.min(e.length-half,(item.x-e.a.x)*e.tx+(item.z-e.a.z)*e.tz));const x=e.a.x+t*e.tx+e.nx*(item.side==='outside'?-.16:.16),z=e.a.z+t*e.tz+e.nz*(item.side==='outside'?-.16:.16);return{x,z,rotation:e.angle+(item.side==='outside'?180:0),d:Math.hypot(x-item.x,z-item.z)};}).sort((a,b)=>a.d-b.d);return{...item,x:choices[0].x,z:choices[0].z,rotation:choices[0].rotation};}
export function placementError(item:Item,items:Item[],polygon=DEFAULT_OUTLINE):string|null{
 const r=bounds(item),entry=entrance(polygon);if(isArt(item.kind)){const fit=snapArt(item,polygon);if(Math.hypot(fit.x-item.x,fit.z-item.z)>.03||Math.abs(fit.rotation-item.rotation)>.01)return '絵画は壁の近くに配置してください';if(intersects(r,{x:entry.x,z:entry.z,w:1.8,d:.5,rotation:entry.angle}))return '入口の上には配置できません';if(items.some(o=>o.id!==item.id&&isArt(o.kind)&&intersects(r,bounds(o),.08)))return '絵画が重なっています';return null;}
 if(!rectInRoom(r,polygon,.088))return '壁の内側に配置してください';if(intersects(r,{x:entry.x+entry.nx*.45,z:entry.z+entry.nz*.45,w:1.4,d:1.1,rotation:entry.angle}))return '入口の前は空けておきましょう';if(item.kind==='robot'&&!canWalk(item.x,item.z,colliders(items),polygon,.3))return 'ロボットのまわりにもう少し余裕を空けてください';if(item.kind==='robot'&&items.filter(o=>o.id!==item.id&&o.kind==='robot').length>=5)return '配膳ロボットは5台まで配置できます';if(items.some(o=>o.id!==item.id&&!isArt(o.kind)&&intersects(r,bounds(o),-.0001)))return 'ほかの家具と重なっています';return null;
}
export function colliders(items:Item[]):Rect[]{const result:Rect[]=[];for(const i of items){if(isArt(i.kind)||i.kind==='robot')continue;const add=(x:number,z:number,w:number,d:number)=>{const a=i.rotation*Math.PI/180;result.push({x:i.x+x*Math.cos(a)-z*Math.sin(a),z:i.z+x*Math.sin(a)+z*Math.cos(a),w,d,rotation:i.rotation});};if(i.kind==='two'){add(0,0,.82,.78);add(0,-.72,.49,.5);add(0,.72,.49,.5);}else if(i.kind==='four'){add(0,0,1.53,.8);add(0,-.78,1.84,.66);add(0,.78,1.84,.66);}else{const s=CATALOG[i.kind];add(0,0,s.w,s.d);}}return result;}
export const canWalk=circleClear;
export function spawnPoint(polygon:Point[],items:Item[]){const e=entrance(polygon),obs=colliders(items);for(let d=.75;d<3;d+=.25){const q={x:e.x+e.nx*d,z:e.z+e.nz*d};if(canWalk(q.x,q.z,obs,polygon))return q;}const candidates:Point[]=[];for(let x=Math.ceil(Math.min(...polygon.map(p=>p.x))*4)/4;x<Math.max(...polygon.map(p=>p.x));x+=.25)for(let z=Math.ceil(Math.min(...polygon.map(p=>p.z))*4)/4;z<Math.max(...polygon.map(p=>p.z));z+=.25)if(canWalk(x,z,obs,polygon))candidates.push({x,z});return candidates.sort((a,b)=>Math.hypot(a.x-e.x,a.z-e.z)-Math.hypot(b.x-e.x,b.z-e.z))[0]??{x:e.x+e.nx*.75,z:e.z+e.nz*.75};}
export function initialItems():Item[]{const list:Item[]=[];for(const x of [-4.5,4.5])for(const z of [-5.75,-3.53,-1.31])list.push({id:`booth-${x}-${z}`,kind:'four',x,z,rotation:0});for(const z of [-5.5,-2.75,0])list.push({id:`two-${z}`,kind:'two',x:-1.25,z,rotation:0});list.push({id:'plant-1',kind:'plant',x:2.5,z:-7.25,rotation:0});list.push({id:"servi-1",kind:"robot",x:2.25,z:3.75,rotation:0});list.push({id:"servi-2",kind:"robot",x:1.25,z:2.5,rotation:0},{id:"servi-3",kind:"robot",x:2.5,z:1.25,rotation:0});(["venus","primavera","cherubs"] as Kind[]).forEach((kind,i)=>list.push(snapArt({id:`art-${kind}`,kind,x:-6,z:-5.5+i*3.5,rotation:0},DEFAULT_OUTLINE)));return list;}
export function parseLayout(value:unknown,polygon=DEFAULT_OUTLINE):Item[]{if(!Array.isArray(value)||value.length>150)throw Error('Invalid layout');const seen=new Set<string>();const result:Item[]=[];for(const v of value){if(!v||typeof v!=='object')throw Error('Invalid item');const i=v as Item;if(typeof i.id!=='string'||i.id.length>100||seen.has(i.id)||!Object.hasOwn(CATALOG,i.kind)||!Number.isFinite(i.x)||!Number.isFinite(i.z)||!Number.isFinite(i.rotation)||(!isArt(i.kind)&&![0,90,180,270].includes(i.rotation)))throw Error('Invalid item');if(i.side!==undefined&&(i.kind!=='logo'||!['inside','outside'].includes(i.side)))throw Error('Invalid panel side');const clean:Item={id:i.id,kind:i.kind,x:i.x,z:i.z,rotation:i.rotation,...(i.side?{side:i.side}:{})};if(placementError(clean,result,polygon))throw Error('Invalid placement');seen.add(i.id);result.push(clean);}return result;}

export function initialLayout():Layout{return{items:initialItems(),outline:DEFAULT_OUTLINE.map(p=>({...p})),chairStyle:'gray',foodEnabled:true};}
export function parseDocument(v:unknown):Layout{if(!v||typeof v!=='object')throw Error('Invalid file');const d=v as Layout&{version:number};if(![1,2].includes(d.version))throw Error('Version');for(const key of ['invertX','invertY'] as const)if(d[key]!==undefined&&typeof d[key]!=='boolean')throw Error('Look setting');if(d.foodEnabled!==undefined&&typeof d.foodEnabled!=='boolean')throw Error('Food setting');const outline=d.outline??DEFAULT_OUTLINE;if(outlineError(outline))throw Error('Outline');if(d.chairStyle!==undefined&&!['gray','woven','perforated'].includes(d.chairStyle))throw Error('Style');return{outline:outline.map(p=>({x:p.x,z:p.z})),items:parseLayout(d.items,outline),chairStyle:d.chairStyle??'woven',foodEnabled:d.foodEnabled??true,invertX:d.invertX??true,invertY:d.invertY??true};}

// Magnetic edge alignment overrides the coarse grid near another object or wall.
export function snapPlacement(raw:Item,items:Item[],polygon:Point[]):Item{
 if(isArt(raw.kind))return snapArt(raw,polygon);
 const base={...raw,x:snap(raw.x),z:snap(raw.z)};if(raw.kind==='robot')return base;
 const own=dimensions(bounds(raw)),xs=[base.x],zs=[base.z];
 for(const other of items){if(other.id===raw.id||isArt(other.kind)||other.kind==='robot')continue;const d=dimensions(bounds(other));
 if(Math.abs(raw.z-other.z)<(own.d+d.d)/2+.3)for(const x of[other.x,other.x-(own.w+d.w)/2,other.x+(own.w+d.w)/2,other.x+(d.w-own.w)/2,other.x-(d.w-own.w)/2])if(Math.abs(x-raw.x)<.20)xs.push(x);
 if(Math.abs(raw.x-other.x)<(own.w+d.w)/2+.3)for(const z of[other.z,other.z-(own.d+d.d)/2,other.z+(own.d+d.d)/2,other.z+(d.d-own.d)/2,other.z-(d.d-own.d)/2])if(Math.abs(z-raw.z)<.20)zs.push(z);
 }
 const candidates:Item[]=[];for(const x of xs)for(const z of zs)candidates.push({...raw,x,z});
 for(const e of edges(polygon)){const along=(raw.x-e.a.x)*e.tx+(raw.z-e.a.z)*e.tz;if(along<0||along>e.length)continue;const support=own.w/2*Math.abs(e.nx)+own.d/2*Math.abs(e.nz),distance=(raw.x-e.a.x)*e.nx+(raw.z-e.a.z)*e.nz,delta=support+.09-distance;if(Math.abs(delta)<.22)candidates.push({...raw,x:raw.x+e.nx*delta,z:raw.z+e.nz*delta});}
 const valid=candidates.filter(c=>!placementError(c,items,polygon));valid.sort((a,b)=>{const magnetic=(c:Item)=>c.x!==base.x||c.z!==base.z;return Number(magnetic(b))-Number(magnetic(a))||Math.hypot(a.x-raw.x,a.z-raw.z)-Math.hypot(b.x-raw.x,b.z-raw.z);});return valid[0]??base;
}

