import * as THREE from 'three';
import motion from './finisher-motion.json';
import {createClashVFX} from './hand-clash-vfx.js';
import {punchPose,PUNCHES} from './punches.js';
import {blendPoses,bracePose} from './combat-poses.js';

const names={Torso:'torso',Head:'head','Right Arm':'rightArm','Left Arm':'leftArm','Right Leg':'rightLeg','Left Leg':'leftLeg'};
const channels={Head:'head','Right Arm':'A0','Left Arm':'A1','Right Leg':'L0','Left Leg':'L1'};
const T=(x=0,y=0,z=0)=>new THREE.Matrix4().makeTranslation(x,y,z);
const fromYUp=new THREE.Matrix4().makeRotationX(Math.PI/2);
const toOldRest=T(0,-3,0).multiply(new THREE.Matrix4().makeRotationX(-Math.PI/2));
const ease=x=>THREE.MathUtils.smoothstep(x,0,1);
const prefix=(poses,angle)=>Object.fromEntries(Object.entries(poses).map(([n,m])=>[n,new THREE.Matrix4().makeRotationZ(angle).multiply(m)]));

export function sampleClash(frame,actorName,grip){
  frame=THREE.MathUtils.clamp(frame,0,motion.frames.length-1);
  const i=Math.floor(frame),a=motion.frames[i].actors[actorName],b=motion.frames[Math.min(i+1,motion.frames.length-1)].actors[actorName],alpha=frame-i;
  const position=new THREE.Vector3(...a.position).lerp(new THREE.Vector3(...b.position),alpha);
  const quat=key=>new THREE.Quaternion().fromArray(a.quaternions[key]).slerp(new THREE.Quaternion().fromArray(b.quaternions[key]),alpha);
  const root=T(0,position.y,0).multiply(new THREE.Matrix4().makeRotationFromQuaternion(quat('torso'))),poses={HumanoidRootPart:new THREE.Matrix4()};
  for(const[bone,part]of Object.entries(names)){
    const old=root.clone();
    if(bone!=='Torso'){
      const key=channels[bone],pivot=new THREE.Vector3(...motion.rigPivots[part]),offsetKey=bone==='Head'?'H':key;
      const offset=new THREE.Vector3(...(a.jointOffsets?.[offsetKey]||[0,0,0])).lerp(new THREE.Vector3(...(b.jointOffsets?.[offsetKey]||[0,0,0])),alpha);
      old.multiply(T(pivot.x+offset.x,pivot.y+offset.y,pivot.z+offset.z)).multiply(new THREE.Matrix4().makeRotationFromQuaternion(quat(key))).multiply(T(-pivot.x,-pivot.y,-pivot.z));
    }
    poses[bone]=fromYUp.clone().multiply(old).multiply(toOldRest);
  }
  poses.Cape=poses.Torso.clone();poses.Sword=poses['Right Arm'].clone().multiply(grip);
  return {poses,offset:new THREE.Vector3(position.x,0,position.z)};
}

export function createFinisher({scene,dummy,characterData,swordBindOffset:grip,scale}){
  const clashVFX=createClashVFX(scene);clashVFX.group.visible=false;clashVFX.group.scale.setScalar(scale);
  const blastGroup=new THREE.Group();blastGroup.name='Ice execution blast';scene.add(blastGroup);blastGroup.visible=false;
  const beamMaterial=new THREE.MeshBasicMaterial({color:0xa9efff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
  const outerMaterial=new THREE.MeshBasicMaterial({color:0x3eafdb,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
  const core=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,1,8),beamMaterial),outer=new THREE.Mesh(new THREE.CylinderGeometry(.32,.16,1,6),outerMaterial);blastGroup.add(core,outer);
  const impact=new THREE.Mesh(new THREE.IcosahedronGeometry(.48,1),new THREE.MeshBasicMaterial({color:0xddfbff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));blastGroup.add(impact);
  const snow=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.035,0),new THREE.MeshBasicMaterial({color:0xcdf7ff,transparent:true,opacity:0,depthWrite:false}),40);blastGroup.add(snow);
  const light=new THREE.PointLight(0x91e7ff,0,10,2);blastGroup.add(light);
  const finish={active:false,time:0,phase:'idle',center:new THREE.Vector3(),forward:new THREE.Vector3(0,0,-1),basis:0,result:null,source:'Earlier authored hand-clash scene',
    start(playerPosition,playerFacing,playerPose){
      this.active=true;this.time=0;this.phase='approach';this.forward.copy(dummy.position).sub(playerPosition).setY(0).normalize();if(!this.forward.lengthSq())this.forward.set(0,0,-1);
      this.center.copy(playerPosition).add(dummy.position).multiplyScalar(.5);this.center.y=0;this.basis=Math.atan2(-this.forward.z,this.forward.x);
      this.fromPosition=playerPosition.clone();this.fromDummy=dummy.position.clone();this.fromPose=prefix(playerPose,playerFacing-this.basis);
      this.fromDummyPose=prefix(Object.fromEntries(Object.entries(dummy.parts).map(([n,p])=>[n,p.matrix.clone()])),dummy.root.rotation.y-this.basis);
      dummy.state='finishing';dummy.respawnAt=Infinity;clashVFX.group.position.copy(this.center);clashVFX.group.rotation.y=this.basis;clashVFX.group.visible=true;this.update(0);
    },
    reset(){this.active=false;this.time=0;this.phase='idle';this.result=null;clashVFX.group.visible=false;blastGroup.visible=false;light.intensity=0;},
    worldPosition(offset){return offset.clone().multiplyScalar(scale).applyAxisAngle(new THREE.Vector3(0,1,0),this.basis).add(this.center);},
    update(dt){
      this.time+=dt;const t=this.time;
      let frame=t<.28?3:t<.55?THREE.MathUtils.lerp(3,4,(t-.28)/.27):t<2.05?THREE.MathUtils.lerp(4,11,(t-.55)/1.5):THREE.MathUtils.lerp(11,15,THREE.MathUtils.clamp((t-2.05)/.45,0,1));
      this.frame=frame;const white=sampleClash(frame,'white',grip),yellow=sampleClash(frame,'yellow',grip);
      let playerPose=white.poses,dummyPose=yellow.poses,playerPosition=this.worldPosition(white.offset),dummyPosition=this.worldPosition(yellow.offset);
      if(t<.28){const a=ease(t/.28);playerPose=blendPoses(this.fromPose,playerPose,a);dummyPose=blendPoses(this.fromDummyPose,dummyPose,a);playerPosition.lerpVectors(this.fromPosition,playerPosition,a);dummyPosition.lerpVectors(this.fromDummy,dummyPosition,a);}
      this.phase=t<.55?'approach':t<2.05?'grapple':t<2.5?'recoil':t<3.12?'charge':t<3.95?'blast':'frozen';
      if(t>=2.5){
        const a=ease((t-2.5)/.35),playerEnd=this.center.clone().addScaledVector(this.forward,-1.65),dummyEnd=this.center.clone().addScaledVector(this.forward,1.65);
        playerPosition.lerp(playerEnd,a);dummyPosition.lerp(dummyEnd,a);
        let punchPhase=t<3.12?THREE.MathUtils.lerp(0,.26,(t-2.5)/.62):t<3.35?THREE.MathUtils.lerp(.26,.45,(t-3.12)/.23):t<3.9?.5:THREE.MathUtils.lerp(.6,1,ease((t-3.9)/.9));
        const blastPose=prefix(punchPose('Right',punchPhase*PUNCHES.Right.duration,characterData.bootBounds,grip),-Math.PI/2);
        playerPose=blendPoses(playerPose,blastPose,a);dummyPose=blendPoses(dummyPose,prefix(bracePose(characterData.bootBounds,grip),Math.PI/2),a);
      }
      dummy.root.position.copy(dummyPosition);dummy.root.rotation.y=this.basis;dummy.applyPose(dummyPose);
      const frozen=THREE.MathUtils.smoothstep(t,3.45,3.95);dummy.setFreeze(frozen);if(frozen===1)dummy.state='frozen';
      clashVFX.group.visible=t<2.5;clashVFX.update(motion,t<2.5?Math.floor(frame):20);
      blastGroup.visible=t>=3.12&&t<4.35;
      const palm=new THREE.Vector3(1.5,.02,.97).applyMatrix4(playerPose['Right Arm']).multiplyScalar(scale).applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI/2)).applyAxisAngle(new THREE.Vector3(0,1,0),this.basis).add(playerPosition);
      const target=dummyPosition.clone().add(new THREE.Vector3(0,1.2,0)),direction=target.clone().sub(palm),length=direction.length();direction.normalize();
      const beamAlpha=THREE.MathUtils.smoothstep(t,3.12,3.24)*(1-THREE.MathUtils.smoothstep(t,3.72,3.92));
      for(const beam of[core,outer]){beam.position.copy(palm).lerp(target,.5);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);beam.scale.set(1,length,1);}
      beamMaterial.opacity=.92*beamAlpha;outerMaterial.opacity=.34*beamAlpha;impact.position.copy(target);impact.scale.setScalar(.3+frozen*2.3);impact.material.opacity=Math.max(0,1-Math.abs(t-3.53)/.35)*.85;
      const age=Math.max(0,t-3.42),m=new THREE.Matrix4();
      for(let i=0;i<40;i++){const angle=i*2.39996,speed=.9+(i%7)*.19;const p=target.clone().add(new THREE.Vector3(Math.cos(angle)*speed*age,Math.sin(i*1.7)*age+age*.4,Math.sin(angle)*speed*age));m.makeRotationFromEuler(new THREE.Euler(i+age,age*2,i*.3));m.setPosition(p);snow.setMatrixAt(i,m);}snow.instanceMatrix.needsUpdate=true;snow.material.opacity=t>=3.42?Math.max(0,1-age/1.05):0;light.position.copy(target);light.intensity=beamAlpha*28;
      const right=new THREE.Vector3(this.forward.z,0,-this.forward.x);
      const cameraPosition=this.center.clone().addScaledVector(right,5.9).addScaledVector(this.forward,-.8).add(new THREE.Vector3(0,2.9,0));
      this.result={poses:playerPose,position:playerPosition,yaw:this.basis,exitPosition:this.center.clone().addScaledVector(this.forward,-1.65),exitFacing:Math.atan2(-this.forward.x,-this.forward.z),cameraPosition,cameraTarget:this.center.clone().add(new THREE.Vector3(0,1.1,0)),done:t>=5};return this.result;
    },
    state(){return{active:this.active,time:this.time,phase:this.phase,source:this.source,frameCount:motion.frames.length,sourceFrame:this.frame||0,bloodIncluded:false,iceBlastVisible:blastGroup.visible,freezeProgress:dummy.freeze};}
  };return finish;
}
