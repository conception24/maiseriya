export function PlanDoor({point:p,nx,nz,width,label,color}:{point:{x:number;z:number};nx:number;nz:number;width:number;label:string;color:string}){
 const w=label.length>2?1.75:1.35, x=p.x-nx*(w/2+.38), z=p.z-nz*.78;
 return <g pointerEvents="none"><title>{label}の開口部</title>
  <path d={`M${p.x-nz*width/2},${p.z+nx*width/2} l${nz*width},${-nx*width}`} stroke={color} strokeWidth=".23"/>
  <path d={`M${p.x},${p.z} L${x},${z}`} stroke={color} strokeWidth=".075"/>
  <rect x={x-w/2} y={z-.32} width={w} height=".64" rx=".12" fill={color}/>
  <text x={x} y={z} textAnchor="middle" dominantBaseline="central" fontWeight="700" fontSize=".45" fill="white">{label}</text></g>;
}
