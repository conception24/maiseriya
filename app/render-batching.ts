import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Batch only static siblings. Keeping their parent preserves seat picking and local transforms. */
export function batchStaticMeshes(root:T.Object3D,excluded:ReadonlySet<T.Object3D>){
 const retired=new Set<T.BufferGeometry>();let before=0,after=0;
 const visit=(parent:T.Object3D)=>{
  if(excluded.has(parent)||!parent.visible)return;
  for(const child of [...parent.children])if(!(child instanceof T.Mesh))visit(child);
  const buckets=new Map<string,T.Mesh<T.BufferGeometry,T.Material>[]>();
  for(const child of parent.children){
   if(!(child instanceof T.Mesh)||child instanceof T.InstancedMesh||child instanceof T.SkinnedMesh||excluded.has(child)||!child.visible||child.children.length||Array.isArray(child.material)||child.material.transparent||child.morphTargetInfluences)continue;
   child.updateMatrix();if(child.matrix.determinant()<=0)continue;
   const geometry=child.geometry;
   if(geometry.drawRange.start!==0||geometry.drawRange.count!==Infinity||Object.keys(geometry.morphAttributes).length)continue;
   // Match vertex layouts and rendering flags. Split large scene-level batches spatially.
   const attributes=Object.keys(geometry.attributes).sort().map(k=>{const a=geometry.attributes[k];return `${k}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`;}).join(',');
   const cell=parent===root?`${Math.floor(child.position.x/4)},${Math.floor(child.position.z/4)}`:'';
   const key=[child.material.uuid,child.castShadow,child.receiveShadow,child.renderOrder,child.layers.mask,child.frustumCulled,attributes,cell].join('|');
   const bucket=buckets.get(key)??[];bucket.push(child as T.Mesh<T.BufferGeometry,T.Material>);buckets.set(key,bucket);
  }
  for(const meshes of buckets.values()){
   if(meshes.length<2)continue;
   const geometries=meshes.map(mesh=>{const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();g.applyMatrix4(mesh.matrix);return g;});
   const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
   if(!geometry)continue;
   geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const first=meshes[0],batch=new T.Mesh(geometry,first.material);
   batch.name='static-batch';batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;batch.renderOrder=first.renderOrder;batch.layers.mask=first.layers.mask;batch.frustumCulled=first.frustumCulled;
   for(const mesh of meshes){retired.add(mesh.geometry);parent.remove(mesh);}
   parent.add(batch);before+=meshes.length;after++;
  }
 };
 visit(root);
 // A geometry may also belong to an excluded, animated object.
 root.traverse(o=>{if(o instanceof T.Mesh)retired.delete(o.geometry);});
 retired.forEach(g=>g.dispose());
 return {before,after,savedDraws:before-after};
}
