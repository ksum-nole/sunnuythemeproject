import * as THREE from 'three';
const T=(x=0,y=0,z=0)=>new THREE.Matrix4().makeTranslation(x,y,z);
const pivot=(x,y,z,rx=0,rz=0)=>T(x,y,z).multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx,0,rz))).multiply(T(-x,-y,-z));
const r=THREE.MathUtils.degToRad;
export function blendPoses(a,b,amount){
  const result={},pa=new THREE.Vector3(),pb=new THREE.Vector3(),qa=new THREE.Quaternion(),qb=new THREE.Quaternion(),sa=new THREE.Vector3(),sb=new THREE.Vector3();
  for(const name of Object.keys(b)){(a[name]||b[name]).decompose(pa,qa,sa);b[name].decompose(pb,qb,sb);result[name]=new THREE.Matrix4().compose(pa.lerp(pb,amount),qa.slerp(qb,amount),sa.lerp(sb,amount));}
  return result;
}
export function settleFeet(poses,bootBounds){
  let lowest=Infinity;const p=new THREE.Vector3();
  for(const side of['Right','Left']){const b=bootBounds[side];for(const x of[b.min[0],b.max[0]])for(const y of[b.min[1],b.max[1]])for(const z of[b.min[2],b.max[2]])lowest=Math.min(lowest,p.set(x,y,z).applyMatrix4(poses[side+' Leg']).z);}
  const lift=T(0,0,-lowest);for(const m of Object.values(poses))m.premultiply(lift);return poses;
}
export function dashPose(time,duration,bootBounds,grip){
  const phase=THREE.MathUtils.clamp(time/duration,0,1),load=Math.sin(Math.PI*phase)**.65;
  const body=T(0,.2*load,-.16*load).multiply(pivot(0,0,2,r(-32*load)));
  const poses={HumanoidRootPart:new THREE.Matrix4(),Torso:body,Head:body.clone().multiply(pivot(0,0,4,r(22*load)))};
  for(const[side,s]of[['Right',1],['Left',-1]]){
    poses[side+' Arm']=body.clone().multiply(pivot(s*1.05,0,3.5,r((side==='Right'?9:0)-46*load),r(-s*(3+5*load))));
    poses[side+' Leg']=T(0,0,-.16*load).multiply(pivot(s*.5,0,2,r((s===1?35:-29)*load)));
  }
  poses.Cape=body.clone().multiply(pivot(0,-.55,3.8,r(17*load)));poses.Sword=poses['Right Arm'].clone().multiply(grip);return settleFeet(poses,bootBounds);
}
export function bracePose(bootBounds,grip){
  const body=pivot(0,0,2,r(10));
  const poses={HumanoidRootPart:new THREE.Matrix4(),Torso:body,Head:body.clone().multiply(pivot(0,0,4,r(-6)))};
  for(const[side,s]of[['Right',1],['Left',-1]]){poses[side+' Arm']=body.clone().multiply(pivot(s*1.05,0,3.5,r(118),r(-s*15)));poses[side+' Leg']=pivot(s*.5,0,2,r(s*6));}
  poses.Cape=body.clone();poses.Sword=poses['Right Arm'].clone().multiply(grip);return settleFeet(poses,bootBounds);
}
