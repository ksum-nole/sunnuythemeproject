import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {execFileSync} from 'node:child_process';
const executablePath=process.env.GAME_TEST_BROWSER||'/Users/jacobatamas/Library/Caches/ms-playwright/chromium-1194/chrome-mac/Chromium.app/Contents/MacOS/Chromium';
// macOS Chromium needs a focused native window to allow real pointer capture.
const browser=await chromium.launch({headless:process.platform!=='darwin',executablePath,args:['--use-gl=angle','--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const cdp=await browser.newBrowserCDPSession();
const contexts=await cdp.send('Target.getBrowserContexts');
await cdp.send('Browser.grantPermissions',{permissions:['pointerLock'],browserContextId:contexts.browserContextIds[0]});
if(process.platform==='darwin')execFileSync('osascript',['-e','tell application '+JSON.stringify(executablePath.split('/Contents/')[0])+' to activate']);
await page.bringToFront();
const state=()=>page.evaluate(()=>window.__iceGame.getState());
const advance=t=>page.evaluate(t=>window.__iceGame.advance(t),t);
const reset=async(x=-7.5,y=.1,z=16)=>{await page.keyboard.up('w');await page.keyboard.up('a');await page.keyboard.up('d');await page.keyboard.up('Shift');if((await state()).shiftLocked)await page.keyboard.press('Shift');await page.evaluate(p=>window.__iceGame.teleport(...p),[x,y,z]);await page.evaluate(()=>window.__iceGame.view(0,.37,5.4));return advance(.3);};
const checks=[];const report={checks};
try{
 await page.goto('file://'+resolve('dist/index.html')+'?test=1');await page.waitForFunction(()=>window.__iceGame?.ready);await page.getByRole('button',{name:'Enter arena'}).click();await page.evaluate(()=>window.__iceGame.setTargetLock(false));await advance(.4);
 await page.keyboard.down('w');let a=await advance(1/120);assert(Math.abs(Math.hypot(a.velocity[0],a.velocity[2])-8.6)<1e-5);
 await page.keyboard.up('w');const stop=(await state()).position;a=await advance(.1);assert(Math.hypot(a.position[0]-stop[0],a.position[2]-stop[2])<1e-5);checks.push('Ground movement starts and stops immediately');
 await page.keyboard.down('w');await page.keyboard.down('d');a=await advance(.08);assert(Math.abs(Math.hypot(a.velocity[0],a.velocity[2])-8.6)<1e-5);checks.push('Diagonal movement is normalized');await reset();
 await page.keyboard.down('w');a=await advance(.2);assert(Math.abs(Math.hypot(a.velocity[0],a.velocity[2])-8.6)<1e-5);assert.equal(a.runAnimation,'Pure_Sprint_Animation.blend');
 const source=JSON.parse(await readFile('dist/assets/run.json','utf8'));const poses=await page.evaluate(()=>window.__iceGame.inspectPose());const f=a.runAnimationTime*source.fps,index=Math.floor(f),alpha=f-index;
 let rotationError=0;
 for(const name of ['Torso','Head','Right Arm','Left Arm','Right Leg','Left Leg']){
  const bytes=Buffer.from(source.clip[name],'base64');const data=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);const qa=new THREE.Quaternion().fromArray(data,index*10+3),qb=new THREE.Quaternion().fromArray(data,(index+1)*10+3);qa.slerp(qb,alpha);const actual=new THREE.Quaternion();new THREE.Matrix4().fromArray(poses[name]).decompose(new THREE.Vector3(),actual,new THREE.Vector3());qa.normalize();actual.normalize();rotationError=Math.max(rotationError,qa.angleTo(actual));
 }
 assert(rotationError<.0001);report.maximumRunRotationError=rotationError;await page.screenshot({path:'reviews/movement/pure-sprint.png'});checks.push('Original Pure Sprint bone motion plays at authored sprint cadence');
 await page.keyboard.press('Space');await page.keyboard.up('w');await page.keyboard.up('Shift');await page.keyboard.down('d');a=await advance(1/120);assert(a.velocity[0]>8.59&&Math.abs(a.velocity[2])<1e-5);checks.push('Air vectoring changes direction immediately');await reset();
 // Turning changes the body orientation smoothly without delaying movement.
 const angle=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
 await page.keyboard.down('d');a=await advance(1/120);assert(a.facing<-.01&&a.facing>-Math.PI/2+.1);assert(a.velocity[0]>8.59);
 a=await advance(.16);assert(angle(a.facing,-Math.PI/2)<.05);await page.keyboard.up('d');
 await page.keyboard.down('a');const beforeReverse=a.facing;a=await advance(1/120);assert(angle(a.facing,beforeReverse)<.6&&angle(a.facing,Math.PI/2)>.5);assert(a.velocity[0]<-8.59);
 await advance(.3);await reset();await page.evaluate(()=>window.__iceGame.view(Math.PI-.05,.37,5.4));await page.keyboard.down('w');await advance(.35);await page.evaluate(()=>window.__iceGame.view(-Math.PI+.05,.37,5.4));const wrapBefore=(await state()).facing;a=await advance(1/120);assert(angle(a.facing,wrapBefore)<.03&&angle(a.facing,-Math.PI+.05)<.1);checks.push('Quick smooth turns and reversals take the shortest path across the angle seam');
 await reset();await page.keyboard.down('d');const fullStep=(await advance(.12)).facing;await reset();await page.keyboard.down('d');await advance(.06);const halfSteps=(await advance(.06)).facing;assert(angle(fullStep,halfSteps)<1e-6);checks.push('Turn response is independent of simulation frame size');
 await reset();await page.keyboard.press('Shift');await page.waitForFunction(()=>document.pointerLockElement===document.getElementById('game'));a=await advance(.8);assert(a.targetLocked&&a.cursorHidden);const lockedYaw=a.cameraYaw,lockedPitch=a.cameraPitch,lockedDistance=a.cameraDistance;await page.mouse.move(820,420);await page.mouse.wheel(0,300);a=await advance(.2);assert(angle(a.cameraYaw,lockedYaw)<.001&&a.cameraPitch===lockedPitch&&a.cameraDistance===lockedDistance);await page.mouse.click(700,400);assert.equal((await state()).activePunch,'Right');await page.keyboard.press('r');await advance(.3);await page.keyboard.press('Shift');await page.waitForFunction(()=>!document.pointerLockElement);assert(!(await state()).targetLocked&&!(await state()).paused);checks.push('Lock-on hides and captures the mouse, blocks manual camera changes, and still allows click attacks');
 await reset();

 // Walk off the foundry's perimeter wall, not through a gallery railing.
 async function leaveLedge(){
  await reset(56,4.1,15.5);const start=await state();assert(start.grounded,'Wall top must be grounded');await page.keyboard.down('a');
  for(let i=0;i<180;i++){const s=await advance(1/120);if(!s.grounded&&s.velocity[1]<-.5&&s.position[1]<start.position[1]-.005&&s.coyoteRemaining>.06){await page.keyboard.up('a');return s;}}
  throw Error('No falling edge found on perimeter wall');
 }
 a=await leaveLedge();report.ledgePosition=a.position;await advance(.055);const oldJumps=(await state()).jumps;await page.keyboard.press('Space');a=await advance(1/120);assert(a.velocity[1]>7.5&&a.jumps===oldJumps+1);await page.keyboard.press('Space');a=await advance(1/120);assert(a.jumps===oldJumps+1);checks.push('Coyote jump works after leaving the ledge, without allowing a double jump');
 await leaveLedge();a=await advance(.18);const expiredJumps=a.jumps;await page.keyboard.press('Space');a=await advance(1/120);assert(a.jumps===expiredJumps&&a.velocity[1]<0);checks.push('Coyote grace expires after its short window');
 await reset();const bufferStart=(await state()).jumps;await page.keyboard.press('Space');await advance(.67);await page.keyboard.press('Space');a=await advance(.11);assert(a.jumps===bufferStart+2&&a.velocity[1]>0);checks.push('A jump pressed just before landing is buffered');
 await reset(54,.1,0);await page.keyboard.down('d');a=await advance(.9);await page.keyboard.up('d');assert(a.position[0]<55.33&&a.position[0]>55.25);assert.equal(a.arenaWallCount,4);for(const [origin,direction] of [[[60,2,0],[-1,0,0]],[[-60,2,0],[1,0,0]],[[0,2,60],[0,0,-1]],[[0,2,-60],[0,0,1]]]){const wall=await page.evaluate(p=>window.__iceGame.raycast(...p),[origin,direction]);assert(wall&&Math.abs(wall.distance-3.7)<.001,JSON.stringify(wall));} checks.push('Arena perimeter walls physically stop the player');
 await reset();const cameraBefore=(await state()).cameraPosition;await page.keyboard.press('v');a=await advance(2.3);assert.equal(a.activeAbility,'V');assert(a.activeIceMeshes>150);assert(Math.hypot(...a.cameraPosition.map((v,i)=>v-cameraBefore[i]))<.01);checks.push('Massive V slam keeps the chosen camera zoom');
 await reset();await page.keyboard.press('c');a=await advance(1.15);assert.equal(a.activeAbility,'C');assert.equal(a.fxAbility,'C');assert(a.activeIceMeshes>70&&a.weaponGripError<.0001);await page.screenshot({path:'reviews/movement/restored-c.png'});checks.push('Original C animation and forward ice burst restored');
 assert.deepEqual(errors,[]);report.status='PASS';report.errors=errors;await writeFile('reviews/movement/validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(e){report.status='FAIL';report.error=String(e);report.state=await state().catch(()=>null);await writeFile('reviews/movement/validation.json',JSON.stringify(report,null,2));await page.screenshot({path:'reviews/movement/failure.png'});throw e;}finally{await browser.close();}
