import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import * as THREE from 'three';
import {PUNCHES,punchPose} from '../punches.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const c=JSON.parse(await fs.readFile(resolve(root,'dist/assets/itrapped.json'),'utf8'));
const grip=new THREE.Matrix4().fromArray(c.idle['Right Arm']).invert().multiply(new THREE.Matrix4().fromArray(c.idle.Sword));
const actions={};
for(const [side,config] of Object.entries(PUNCHES)){
 const count=Math.round(config.duration*60);
 const poses=Array.from({length:count+1},(_,i)=>Object.fromEntries(Object.entries(punchPose(side,i/count*config.duration,c.bootBounds,grip)).map(([n,m])=>[n,m.toArray()])));
 actions[side]={...config,fps:60,frames:poses.length,impactFrame:Math.round(config.impact*60),poses};
}
await fs.writeFile(resolve(root,'source/punches/poses.json'),JSON.stringify({rig:c.rigName,actions}));
console.log(JSON.stringify(Object.fromEntries(Object.entries(actions).map(([n,c])=>[n,{frames:c.frames,duration:c.duration,impactFrame:c.impactFrame}]))));
