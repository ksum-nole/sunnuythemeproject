import * as THREE from 'three';

export function createOpenArena() {
  const halfSize=56, group=new THREE.Group(),collisionRoot=new THREE.Group();
  group.name='CINDER 07 | Open training arena';
  const floorMaterial=new THREE.MeshStandardMaterial({color:0x526d78,roughness:.82,metalness:.12});
  const wallMaterial=new THREE.MeshStandardMaterial({color:0x273f4c,roughness:.65,metalness:.3});
  const capMaterial=new THREE.MeshStandardMaterial({color:0x6d929e,roughness:.45,metalness:.3});
  const lightMaterial=new THREE.MeshBasicMaterial({color:0xa7ebff});
  // Extend the foundation beyond the walls so their outer faces remain
  // inside the collision tree bounds rather than on a subdivision edge.
  const floor=new THREE.Mesh(new THREE.BoxGeometry(116,.8,116),floorMaterial);
  floor.name='Uninterrupted training floor';floor.position.y=-.4;floor.receiveShadow=true;group.add(floor);collisionRoot.add(floor.clone());
  const grid=new THREE.GridHelper(112,28,0x89b0bb,0x72939e);grid.position.y=.006;grid.material.transparent=true;grid.material.opacity=.26;grid.material.depthWrite=false;group.add(grid);
  for(const [x,z,sx,sz]of[[-halfSize,0,.6,112.6],[halfSize,0,.6,112.6],[0,-halfSize,112.6,.6],[0,halfSize,112.6,.6]]){
    const wall=new THREE.Mesh(new THREE.BoxGeometry(sx,4,sz),wallMaterial);wall.position.set(x,2,z);wall.name='Solid arena perimeter';wall.castShadow=wall.receiveShadow=true;group.add(wall);collisionRoot.add(wall.clone());
    const cap=new THREE.Mesh(new THREE.BoxGeometry(sx+.05,.16,sz+.05),capMaterial);cap.position.set(x,4.02,z);group.add(cap);
    const strip=new THREE.Mesh(new THREE.BoxGeometry(sx+.06,.055,sz+.06),lightMaterial);strip.position.set(x,3.72,z);group.add(strip);
  }
  // Details stay on the perimeter; the entire playable floor is unobstructed.
  for(const x of[-55.5,55.5])for(const z of[-55.5,55.5]){
    const beacon=new THREE.Mesh(new THREE.BoxGeometry(.35,5.5,.35),capMaterial);beacon.position.set(x,2.75,z);group.add(beacon);
    const glow=new THREE.Mesh(new THREE.BoxGeometry(.38,.8,.38),lightMaterial);glow.position.set(x,5.1,z);group.add(glow);
  }
  let triangles=0;group.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
  return {group,collisionRoot,halfSize,wallCount:4,triangles,collisionTriangles:60,spawn:new THREE.Vector3(0,.1,14)};
}
