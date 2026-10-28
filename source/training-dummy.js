import * as THREE from 'three';

export function createTrainingDummy(scene,scale,spawn){
  const root=new THREE.Group(),body=new THREE.Group();root.name='Training dummy';body.rotation.x=-Math.PI/2;body.scale.setScalar(scale);root.add(body);scene.add(root);
  const colors={armor:0xc5d1d7,torso:0xc97636,dark:0x263c48,face:0x8aafb8};
  const materials=Object.fromEntries(Object.entries(colors).map(([n,color])=>[n,new THREE.MeshStandardMaterial({color,roughness:.6,metalness:.16})]));
  const rows=[['Torso',[0,0,3],[2,1,2],'torso'],['Head',[0,0,4.5],[1.05,1.05,1.05],'armor'],['Right Arm',[1.5,0,3],[1,1,2],'armor'],['Left Arm',[-1.5,0,3],[1,1,2],'armor'],['Right Leg',[.5,0,1],[1,1,2],'dark'],['Left Leg',[-.5,0,1],[1,1,2],'dark']];
  const parts={};
  for(const[name,center,size,material]of rows){const joint=new THREE.Group();joint.name=name;joint.matrixAutoUpdate=false;body.add(joint);const geometry=name==='Head'?new THREE.CylinderGeometry(.55,.55,1.05,16).rotateX(Math.PI/2):new THREE.BoxGeometry(...size);const mesh=new THREE.Mesh(geometry,materials[material]);mesh.position.fromArray(center);mesh.castShadow=mesh.receiveShadow=true;joint.add(mesh);parts[name]=joint;}
  const visor=new THREE.Mesh(new THREE.BoxGeometry(.7,.035,.18),materials.dark);visor.position.set(0,.55,4.56);parts.Head.add(visor);
  const badge=new THREE.Mesh(new THREE.BoxGeometry(.65,.035,.65),materials.face);badge.position.set(0,.52,3);parts.Torso.add(badge);
  const shell=new THREE.Group();root.add(shell);shell.visible=false;
  const shellMaterial=new THREE.MeshPhysicalMaterial({color:0x8addff,transparent:true,opacity:.36,roughness:.18,metalness:.12,depthWrite:false,flatShading:true});
  const casing=new THREE.Mesh(new THREE.CylinderGeometry(.83,1.02,2.35,6),shellMaterial);casing.position.y=1.05;shell.add(casing);
  const shardMaterial=new THREE.MeshStandardMaterial({color:0x89dafa,emissive:0x123a50,roughness:.2,metalness:.12});
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2;const shard=new THREE.Mesh(new THREE.ConeGeometry(.13,.55+(i%3)*.1,4),shardMaterial);shard.position.set(Math.cos(a)*.78,.2,Math.sin(a)*.78);shard.rotation.z=Math.sin(a)*.25;shell.add(shard);}
  const dummy={root,body,parts,spawn:spawn.clone(),health:100,maxHealth:100,state:'alive',recoil:0,respawnAt:Infinity,freeze:0,shell,
    reset(){this.health=this.maxHealth;this.state='alive';this.recoil=0;this.respawnAt=Infinity;this.setFreeze(0);root.position.copy(this.spawn);root.rotation.y=Math.PI;this.applyPose({});},
    applyPose(poses){for(const[name,joint]of Object.entries(parts)){joint.matrix.copy(poses[name]||new THREE.Matrix4());joint.matrixWorldNeedsUpdate=true;}},
    setFreeze(amount){this.freeze=amount;shell.visible=amount>0;shell.scale.setScalar(Math.max(.001,amount));for(const[name,m]of Object.entries(materials)){m.color.setHex(colors[name]).lerp(new THREE.Color(0x99e4ff),amount*.88);m.roughness=.6-.38*amount;m.metalness=.16+.16*amount;}},
    update(dt,time,controlled=false){if(this.state==='frozen'&&time>=this.respawnAt)this.reset();if(controlled||this.state!=='alive')return;this.recoil=Math.max(0,this.recoil-dt);const bend=this.recoil>0?Math.sin(this.recoil/.24*Math.PI)*.13:0;const m=new THREE.Matrix4().makeTranslation(0,0,2).multiply(new THREE.Matrix4().makeRotationX(bend)).multiply(new THREE.Matrix4().makeTranslation(0,0,-2));this.applyPose({Torso:m,Head:m,'Right Arm':m,'Left Arm':m});},
    hit(damage){if(this.state!=='alive')return false;this.health=Math.max(0,this.health-damage);this.recoil=.24;return this.health===0;},
    get position(){return root.position;}
  };dummy.reset();return dummy;
}
