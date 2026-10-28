import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright-core';
import * as THREE from 'three';
import {PUNCHES,punchPose} from './punches.js';
const c=JSON.parse(await readFile('dist/assets/itrapped.json','utf8'));
const grip=new THREE.Matrix4().fromArray(c.idle['Right Arm']).invert().multiply(new THREE.Matrix4().fromArray(c.idle.Sword));
const checks=[];
for(const [side,clip]of Object.entries(PUNCHES)){
 const sign=side==='Right'?1:-1,previous={};let maxAngle=0;
 const hand=phase=>new THREE.Vector3(sign*1.5,0,2.03).applyMatrix4(punchPose(side,phase*clip.duration,c.bootBounds,grip)[side+' Arm']);
 assert(hand(.4).y-hand(.26).y>1.8,'Punch must extend decisively from its chamber');
 assert(Math.abs(hand(.4).x)<.65,'Striking fist should cross toward the center line');
 for(let i=0;i<=240;i++){
  const poses=punchPose(side,i/240*clip.duration,c.bootBounds,grip);let low=Infinity;
  for(const [name,m]of Object.entries(poses)){
   assert(m.elements.every(Number.isFinite));assert(Math.abs(m.determinant()-1)<1e-5,'Rigid R6 bones may not stretch');
   const q=new THREE.Quaternion().setFromRotationMatrix(m).normalize();if(previous[name])maxAngle=Math.max(maxAngle,previous[name].angleTo(q));previous[name]=q;
  }
  for(const limb of ['Right','Left']){const b=c.bootBounds[limb];for(const x of[b.min[0],b.max[0]])for(const y of[b.min[1],b.max[1]])for(const z of[b.min[2],b.max[2]])low=Math.min(low,new THREE.Vector3(x,y,z).applyMatrix4(poses[limb+' Leg']).z);}
  assert(Math.abs(low)<1e-5,'At least one boot must remain grounded');
 }
 assert(maxAngle<.13,'Punch motion must remain continuous');
 const torso=punchPose(side,clip.duration*.4,c.bootBounds,grip).Torso;const yaw=Math.atan2(torso.elements[1],torso.elements[0]);assert(Math.abs(yaw)>.4,'Chest must drive the punch');
 const start=punchPose(side,0,c.bootBounds,grip),end=punchPose(side,clip.duration,c.bootBounds,grip);for(const n of Object.keys(start))assert(start[n].elements.every((v,i)=>Math.abs(v-end[n].elements[i])<1e-6));
}
checks.push('Both arms extend across the center line with torso torque, rigid limbs, grounded boots, continuous curves, and clean idle endpoints');
const browser=await chromium.launch({headless:true,executablePath:process.env.GAME_TEST_BROWSER||'/Users/jacobatamas/Library/Caches/ms-playwright/chromium-1194/chrome-mac/Chromium.app/Contents/MacOS/Chromium',args:['--use-gl=angle','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file://'+resolve('dist/index.html')+'?test=1');await page.waitForFunction(()=>window.__iceGame?.ready);await page.getByRole('button',{name:'Enter foundry'}).click();
 const advance=t=>page.evaluate(t=>window.__iceGame.advance(t),t);const state=()=>page.evaluate(()=>window.__iceGame.getState());await advance(.4);
 for(const [side,key]of[['Left','z'],['Right','x']]){
  const before=await state();await page.keyboard.press(key);let a=await state();assert.equal(a.activePunch,side);assert.equal(a.punchesThrown[side],before.punchesThrown[side]+1);
  await page.keyboard.down('w');await page.keyboard.press('Space');await page.keyboard.press('v');await page.keyboard.press(key==='z'?'x':'z');a=await advance(PUNCHES[side].impact);assert.equal(a.activePunch,side);assert.equal(a.casts,before.casts);assert.equal(a.jumps,before.jumps);assert(a.position.every((v,i)=>Math.abs(v-before.position[i])<1e-6));assert(a.weaponGripError<.00001);
  await page.keyboard.up('w');a=await advance(PUNCHES[side].duration);assert.equal(a.activePunch,null);assert(!a.locked);
 }
 checks.push('Z and X play the correct arm; punch recovery restores control; attacks do not overlap ice or jump actions');
 await page.keyboard.press('v');await page.keyboard.press('z');assert.equal((await state()).activePunch,null);await page.keyboard.press('r');await advance(.4);await page.keyboard.press('Space');await page.keyboard.press('x');assert.equal((await state()).activePunch,null);await page.keyboard.press('r');await advance(.4);await page.keyboard.press('z');await page.keyboard.press('r');assert.equal((await state()).activePunch,null);
 checks.push('Ice casting, airborne input, and reset cannot leave a stuck punch');assert.deepEqual(errors,[]);const report={status:'PASS',checks,errors};await writeFile('reviews/punches/validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
