import * as THREE from 'three';

export const FIST_ANCHORS = { Right:[1.5,.02,1.9], Left:[-1.5,.02,1.9] };

// Opaque, flat-shaded facets keep the crystals crisp while the fists move.
export function crystalGeometry() {
  const positions=[], colors=[];
  const palette=[0x218fb6,0x65cbea,0xc7f4ff,0x3caed1].map(hex=>new THREE.Color(hex));
  const triangle=(a,b,c,index)=>{
    positions.push(...a,...b,...c);
    for(let i=0;i<3;i++)colors.push(...palette[index%palette.length].toArray());
  };
  const ring=(x,y,r,z,n,angle=0)=>Array.from({length:n},(_,i)=>[x+Math.cos(i/n*Math.PI*2+angle)*r,y+Math.sin(i/n*Math.PI*2+angle)*r,z]);
  const capTop=ring(0,0,.59,.16,8,Math.PI/8),capBottom=ring(0,0,.54,-.11,8,Math.PI/8);
  for(let i=0;i<8;i++){
    const j=(i+1)%8;
    triangle(capTop[i],capBottom[i],capBottom[j],i);triangle(capTop[i],capBottom[j],capTop[j],i);
    triangle([0,0,-.11],capBottom[j],capBottom[i],i);
  }
  for(const [x,y,r,length,lx,ly] of [[0,0,.28,.93,.02,.01],[-.31,.02,.22,.72,-.15,0],[.30,.04,.22,.66,.13,.02],[0,-.32,.21,.61,0,-.13],[.01,.32,.21,.73,0,.12],[-.26,.29,.15,.47,-.05,.08],[.28,-.26,.15,.49,.08,-.05]]){
    const base=ring(x,y,r,.02,5,.2),mid=ring(x+lx*.4,y+ly*.4,r*.65,-length*.52,5,.2),tip=[x+lx,y+ly,-length];
    for(let i=0;i<5;i++){
      const j=(i+1)%5;
      triangle(base[i],mid[i],mid[j],i);triangle(base[i],mid[j],base[j],i);triangle(mid[i],tip,mid[j],i+1);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();return geometry;
}

export function attachIceFists(bones,restMatrices) {
  const geometry=crystalGeometry();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.24,metalness:.16,emissive:0x0c354a,emissiveIntensity:.38});
  return Object.fromEntries(Object.entries(FIST_ANCHORS).map(([side,anchor])=>{
    const group=new THREE.Group();group.name=side+' fist | ice crystal knuckles';group.matrixAutoUpdate=false;
    group.matrix.copy(restMatrices[side+' Arm']).invert().multiply(new THREE.Matrix4().makeTranslation(...anchor));
    const mesh=new THREE.Mesh(geometry,material);mesh.name=side+' fist | seven faceted crystals';mesh.castShadow=true;group.add(mesh);
    bones[side+' Arm'].add(group);return [side,group];
  }));
}
