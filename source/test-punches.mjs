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
 assert(hand(.42).y-hand(.26).y>1.8,'Punch must extend decisively from its chamber');
 assert(Math.abs(hand(.42).x)<.65,'Striking fist should cross toward the center line');
 assert(hand(.42).y>3.5,'Sideways stance must substantially increase reach');
 const extension=punchPose(side,clip.impact,c.bootBounds,grip);const axis=new THREE.Vector3(0,0,-1).transformDirection(extension[side+' Arm']);assert(axis.dot(new THREE.Vector3(0,1,0))>.999,'Striking arm must be horizontal and point forward at full extension');
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
 const torso=punchPose(side,clip.duration*.42,c.bootBounds,grip).Torso;const yaw=Math.atan2(torso.elements[1],torso.elements[0]);assert(Math.abs(Math.abs(yaw)-Math.PI/2)<1e-6,'Torso must complete exactly 90 degrees');
 for(const phase of [.42,.5,.59]){const pose=punchPose(side,phase*clip.duration,c.bootBounds,grip);const r=new THREE.Vector3(.5,0,.21).applyMatrix4(pose['Right Leg']),l=new THREE.Vector3(-.5,0,.21).applyMatrix4(pose['Left Leg']);assert(Math.abs(r.y-l.y)>1.15&&Math.abs(r.x-l.x)<.35,'Feet must form a front/back bladed stance');for(const limb of ['Right','Left']){const m=pose[limb+' Leg'];assert(Math.abs(Math.abs(Math.atan2(m.elements[1],m.elements[0]))-Math.PI/2)<1e-6,'Both feet must complete the full 90-degree turn');}const arm=new THREE.Vector3(0,0,-1).transformDirection(pose[side+' Arm']);assert(arm.y>.999,'Full extension must remain readable through the contact hold');}
 assert(clip.duration<=.75,'The complete punch must play at the requested faster pace');
 const start=punchPose(side,0,c.bootBounds,grip),end=punchPose(side,clip.duration,c.bootBounds,grip);for(const n of Object.keys(start))assert(start[n].elements.every((v,i)=>Math.abs(v-end[n].elements[i])<1e-6));
}
checks.push('Faster punches hold full forward extension with an exact 90-degree torso and foot turn; limbs remain rigid and curves remain continuous');
const browser=await chromium.launch({headless:true,executablePath:process.env.GAME_TEST_BROWSER||'/Users/jacobatamas/Library/Caches/ms-playwright/chromium-1194/chrome-mac/Chromium.app/Contents/MacOS/Chromium',args:['--use-gl=angle','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file://'+resolve('dist/index.html')+'?test=1');await page.waitForFunction(()=>window.__iceGame?.ready);await page.getByRole('button',{name:'Enter foundry'}).click();
 const checkFists=async()=>{const fists=await page.evaluate(()=>window.__iceGame.inspectIceFists());for(const side of ['Left','Right']){assert(fists[side].visible&&fists[side].crystals===7);assert(fists[side].attachmentError<.00001,'Ice crystals must stay exactly attached to the hand');}};
 const advance=t=>page.evaluate(t=>window.__iceGame.advance(t),t);const state=()=>page.evaluate(()=>window.__iceGame.getState());await advance(.4);await checkFists();
 for(const [side,key]of[['Left','z'],['Right','x']]){
  const before=await state();await page.keyboard.press(key);let a=await state();assert.equal(a.activePunch,side);assert.equal(a.punchesThrown[side],before.punchesThrown[side]+1);
  await page.keyboard.down('w');await page.keyboard.press('Space');await page.keyboard.press('v');await page.keyboard.press(key==='z'?'x':'z');a=await advance(PUNCHES[side].impact);assert.equal(a.activePunch,side);assert.equal(a.casts,before.casts);assert.equal(a.jumps,before.jumps);assert(a.position.every((v,i)=>Math.abs(v-before.position[i])<1e-6));assert(a.weaponGripError<.00001);await checkFists();
  await page.keyboard.up('w');a=await advance(PUNCHES[side].duration);assert.equal(a.activePunch,null);assert(!a.locked);await checkFists();
 }
 checks.push('Z and X play the correct arm; punch recovery restores control; attacks do not overlap ice or jump actions');
 await page.keyboard.press('v');await page.keyboard.press('z');assert.equal((await state()).activePunch,null);await page.keyboard.press('r');await advance(.4);await page.keyboard.press('Space');await page.keyboard.press('x');assert.equal((await state()).activePunch,null);await page.keyboard.press('r');await advance(.4);await page.keyboard.press('z');await page.keyboard.press('r');assert.equal((await state()).activePunch,null);
 checks.push('Ice casting, airborne input, and reset cannot leave a stuck punch');await advance(.4);await page.keyboard.press('c');await advance(1.15);await checkFists();await page.keyboard.press('r');await advance(.4);await page.keyboard.press('v');await advance(2.25);await checkFists();checks.push('Seven ice crystals on each fist stay attached through both punches, idle, recovery, C and V');assert.deepEqual(errors,[]);const report={status:'PASS',checks,errors};await writeFile('reviews/punches/validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
