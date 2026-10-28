import * as THREE from 'three';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import { ICE, CHARACTER, RUN, LEGACY_ICE, LEGACY_MOTION } from './generated-assets.js';
import { PUNCHES, punchPose } from './punches.js';
import { attachIceFists, FIST_ANCHORS } from './ice-fists.js';
import { createOpenArena } from './open-arena.js';

const $ = id => document.getElementById(id);
const TEST = new URLSearchParams(location.search).has('test');
const SCALE = 0.36;
const CAST_DURATION = (CHARACTER.frames - 1) / CHARACTER.fps;
const COOLDOWN = 10;
const IMPACT = ICE.impactFrame / ICE.fps;
const FX_DURATION = ICE.fxDuration;
const ABILITIES = {
  V: { motion: CHARACTER, ice: ICE, duration: CAST_DURATION, impact: IMPACT, fxDuration: FX_DURATION, cooldown: COOLDOWN, label: 'Massive ice slam' },
  C: { motion: LEGACY_MOTION, ice: LEGACY_ICE, duration: (LEGACY_MOTION.frames - 1) / LEGACY_MOTION.fps, impact: (LEGACY_ICE.impactFrame - 1) / LEGACY_ICE.fps, fxDuration: 3.05, cooldown: 5, label: 'Ice stomp' }
};
const PUNCH_SEQUENCE=['Right','Left','Right','Left'],PUNCH_COOLDOWN=.7,COMBO_WINDOW=1;
const COYOTE_TIME = 0.12, JUMP_BUFFER = 0.12;
const MOVE_SPEED = 8.6, TURN_RESPONSE = 22;
const UP = new THREE.Vector3(0, 1, 0);
const Z_UP = new THREE.Vector3(0, 0, 1);
const TAU = Math.PI * 2;
const keys = new Set();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x718c99);
scene.fog = new THREE.FogExp2(0x718c99, 0.0045);
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const camera = new THREE.PerspectiveCamera(53, innerWidth / innerHeight, 0.075, 210);
const hemi = new THREE.HemisphereLight(0xc0e1f6, 0x5a625f, 2.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffedcf, 3.1);
sun.position.set(-18, 37, 17);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -68, right: 68, top: 64, bottom: -64, near: 1, far: 180 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.035;
scene.add(sun, sun.target);
const skyFill = new THREE.DirectionalLight(0xb8e8ff, 1.1);
skyFill.position.set(24, 17, -22);
scene.add(skyFill);

function bytes64(string) {
  const raw = atob(string), bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}
const floats = string => new Float32Array(bytes64(string));
function meshGeometry(encoded, indices) {
  const geometry = new THREE.BufferGeometry();
  const buffer = new THREE.InterleavedBuffer(floats(encoded), 9);
  geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(buffer, 3, 0));
  geometry.setAttribute('normal', new THREE.InterleavedBufferAttribute(buffer, 3, 3));
  geometry.setAttribute('color', new THREE.InterleavedBufferAttribute(buffer, 3, 6));
  if (indices) geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(bytes64(indices)), 1));
  geometry.computeBoundingSphere();
  return geometry;
}
const arena=createOpenArena();
scene.add(arena.group);
const world=new Octree().fromGraphNode(arena.collisionRoot);
const spawn=arena.spawn;
const velocity = new THREE.Vector3();
const capsule = new Capsule(new THREE.Vector3(0, 0.38, 0), new THREE.Vector3(0, 1.6, 0), 0.38);
const groundProbe = new Capsule();
let grounded = false, started = false, paused = false;
let cameraYaw = 0, cameraPitch = 0.37, cameraDistance = 5.4;
let shiftLocked = false, dragging = false, pointerWasLocked = false;
let facing = 0, runPhase = 0, runTime = 0, simTime = 0;
let castTime = -1, fxTime = -1, casts = 0, castKey = 'V', fxKey = 'V';
let punchTime = -1, punchSide = 'Left', punchStartPose = null;
const punchesThrown = { Left: 0, Right: 0 };
let comboStep=0,comboQueued=0,comboExpiresAt=-Infinity,punchCooldown=0,punchInCombo=false;
const cooldowns = { C: 0, V: 0 };
let lastGroundedAt = -Infinity, coyoteAvailable = false, jumpBufferedUntil = -Infinity, jumps = 0;
let shake = 0, impactFired = false, jumping = false;
const lockedAt = new THREE.Vector3();
const actor = new THREE.Group();
actor.name = 'Itrapped | imported R6 player';
const character = new THREE.Group();
character.rotation.x = -Math.PI / 2;
character.scale.setScalar(SCALE);
actor.add(character);
scene.add(actor);
// Itrapped's original Blender mesh data, weights, rest matrices and nine-bone hierarchy.
const boneIndex = Object.fromEntries(CHARACTER.bones.map((b, i) => [b.name, i]));
const restMatrices = Object.fromEntries(CHARACTER.bones.map(b => [b.name, new THREE.Matrix4().fromArray(b.rest)]));
const poseMatrices = Object.fromEntries(CHARACTER.bones.map(b => [b.name, new THREE.Matrix4()]));
const importedBones = CHARACTER.bones.map(b => {
  const bone = new THREE.Bone(); bone.name = b.name; bone.matrixAutoUpdate = false;
  const local = restMatrices[b.name].clone();
  if (b.parent) local.premultiply(restMatrices[b.parent].clone().invert());
  bone.matrix.copy(local); return bone;
});
for (const info of CHARACTER.bones) {
  const bone = importedBones[boneIndex[info.name]];
  if (info.parent) importedBones[boneIndex[info.parent]].add(bone);
  else character.add(bone);
}
const importedSkeleton = new THREE.Skeleton(importedBones, CHARACTER.bones.map(b => restMatrices[b.name].clone().invert()));
const skinMeshes = new Map();
for (const row of CHARACTER.groups) {
  const geometry = meshGeometry(row.vertices, row.indices);
  geometry.setAttribute('skinIndex', new THREE.Uint8BufferAttribute(new Uint8Array(bytes64(row.skinIndex)), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(floats(row.skinWeight), 4));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(floats(row.uv), 2));
  const p = row.material;
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: p.metalness, roughness: p.roughness, emissive: new THREE.Color(...p.emission), emissiveIntensity: p.emissionStrength, side: THREE.DoubleSide });
  if (p.texture) { material.map = new THREE.TextureLoader().load(p.texture); material.map.colorSpace = THREE.SRGBColorSpace; }
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = p.name; mesh.castShadow = true; mesh.frustumCulled = false;
  character.add(mesh); mesh.bind(importedSkeleton, new THREE.Matrix4());
  skinMeshes.set(p.name, mesh);
}
const iceFists = attachIceFists(Object.fromEntries(importedBones.map(bone=>[bone.name,bone])),restMatrices);
const boneData = Object.fromEntries(Object.entries(CHARACTER.clip).map(([n, data]) => [n, floats(data)]));
const legacyBoneData = Object.fromEntries(Object.entries(LEGACY_MOTION.clip).map(([n,data])=>[n,floats(data)]));
const runBoneData = Object.fromEntries(Object.entries(RUN.clip).map(([n,data])=>[n,floats(data)]));
const swordBindOffset = new THREE.Matrix4().fromArray(CHARACTER.idle['Right Arm']).invert().multiply(new THREE.Matrix4().fromArray(CHARACTER.idle.Sword));
const desiredBoneMatrices = {};
function updateImportedRig() {
  for (const info of CHARACTER.bones) desiredBoneMatrices[info.name] = poseMatrices[info.name].clone().multiply(restMatrices[info.name]);
  for (const info of CHARACTER.bones) {
    const bone = importedBones[boneIndex[info.name]];
    bone.matrix.copy(desiredBoneMatrices[info.name]);
    if (info.parent) bone.matrix.premultiply(desiredBoneMatrices[info.parent].clone().invert());
    bone.matrixWorldNeedsUpdate = true;
  }
}
function verifyImportedSkin() {
  const savedTime = castTime;
  const savedKey = castKey; castKey = 'V';
  let maximumError = 0;
  const errorsByFrame = [];
  for (const reference of CHARACTER.references) {
    castTime = reference.frame / 60; animateCharacter(0);
    scene.updateMatrixWorld(true); importedSkeleton.update();
    let frameError = 0;
    for (const sample of reference.samples) {
      const mesh = skinMeshes.get(sample.group);
      const restPoint = new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'), sample.index);
      const actual = mesh.applyBoneTransform(sample.index, restPoint);
      frameError = Math.max(frameError, actual.distanceTo(new THREE.Vector3(...sample.point)));
    }
    maximumError = Math.max(maximumError, frameError); errorsByFrame.push({ frame: reference.frame, error: frameError });
  }
  castTime = savedTime; castKey = savedKey; animateCharacter(0); scene.updateMatrixWorld(true); importedSkeleton.update();
  return { maximumError, errorsByFrame, boneCount: importedBones.length, skinMeshCount: skinMeshes.size, sourceMeshCount: CHARACTER.sourceMeshCount };
}

const fx = new THREE.Group(), fxBasis = new THREE.Group();
fxBasis.rotation.x = -Math.PI / 2;
fxBasis.scale.setScalar(SCALE);
fx.add(fxBasis); scene.add(fx);
fx.visible = false;
const fxMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.23, metalness: 0.2, emissive: 0x12415a, emissiveIntensity: 0.28, transparent: true, opacity: 1, depthWrite: true, side: THREE.DoubleSide });
fxMaterial.forceSinglePass = true;
const effectSets = Object.fromEntries(Object.entries(ABILITIES).map(([key,ability])=>{
  const group = new THREE.Group();group.visible=false;fxBasis.add(group);
  const rows=ability.ice.objects.map(row=>{
    const mesh=new THREE.Mesh(meshGeometry(row.vertices),fxMaterial);mesh.name=row.name;mesh.matrixAutoUpdate=false;mesh.frustumCulled=false;group.add(mesh);return {mesh,samples:floats(row.samples)};
  });return [key,{group,rows}];
}));
const shockwaves = [];
for (let i = 0; i < 2; i++) {
  const material = new THREE.MeshBasicMaterial({ color: 0xb5f1ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.97, 1.0, 80).rotateX(-Math.PI / 2), material);
  ring.position.set(ICE.contact[0] * SCALE, 0.035 + i * 0.008, -ICE.contact[1] * SCALE); fx.add(ring); shockwaves.push(ring);
}
const frostLight = new THREE.PointLight(0x82dfff, 0, 11, 2);
fx.add(frostLight);
const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scaling = new THREE.Vector3();
const p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), s1 = new THREE.Vector3(), s2 = new THREE.Vector3();
function sampleTRS(values, index, stride, target) {
  p1.fromArray(values, index * stride); q1.fromArray(values, index * stride + 3); s1.fromArray(values, index * stride + 7);
  p2.fromArray(values, Math.min(index + 1, values.length / stride - 1) * stride);
  q2.fromArray(values, Math.min(index + 1, values.length / stride - 1) * stride + 3);
  s2.fromArray(values, Math.min(index + 1, values.length / stride - 1) * stride + 7);
  position.copy(p1).lerp(p2, target); quaternion.copy(q1).slerp(q2, target); scaling.copy(s1).lerp(s2, target);
}
const M = () => new THREE.Matrix4();
const T = (x = 0, y = 0, z = 0) => M().makeTranslation(x, y, z);
function pivot(x, y, z, rx = 0, ry = 0, rz = 0) {
  return T(x, y, z).multiply(M().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ'))).multiply(T(-x, -y, -z));
}
const radians = THREE.MathUtils.degToRad;
function proceduralPose(dt) {
  const speed = Math.hypot(velocity.x, velocity.z), moving = speed > 0.15 && grounded;
  if(moving){
    runTime=(runTime+dt*speed/8.6)%RUN.duration;
    const frame=runTime*RUN.fps,index=Math.floor(frame),amount=frame-index;
    for(const [name,values] of Object.entries(runBoneData)){
      sampleTRS(values,index,10,amount);poseMatrices[name].compose(position,quaternion,scaling);
    }
    poseMatrices.Cape.copy(poseMatrices.Torso);
    poseMatrices.Sword.copy(poseMatrices['Right Arm']).multiply(swordBindOffset);
    let low=Infinity;
    for(const side of ['Right','Left']){
      const bounds=CHARACTER.bootBounds[side];
      for(const x of [bounds.min[0],bounds.max[0]])for(const y of [bounds.min[1],bounds.max[1]])for(const z of [bounds.min[2],bounds.max[2]])low=Math.min(low,p1.set(x,y,z).applyMatrix4(poseMatrices[side+' Leg']).z);
    }
    const lift=T(0,0,-low);for(const matrix of Object.values(poseMatrices))matrix.premultiply(lift);
    updateImportedRig();return;
  }
  if (moving) runPhase += dt * speed / 2.4 * TAU;
  const swing = moving ? Math.sin(runPhase) : 0;
  const bob = moving ? 0.06 * Math.cos(runPhase * 2) : 0.018 * Math.sin(simTime * 1.8);
  const body = T(0, 0, bob).multiply(pivot(0, 0, 2, moving ? radians(-7) : 0));
  const poses = { Torso: body, Head: body.clone().multiply(pivot(0, 0, 4, moving ? radians(5) : 0)) };
  for (const [side, sign] of [['Right', 1], ['Left', -1]]) {
    poses[side + ' Arm'] = body.clone().multiply(pivot(sign * 1.05, 0, 3.5, radians((side === 'Right' ? 9 : 0) - swing * 35 * sign), 0, radians(-sign * 3)));
    poses[side + ' Leg'] = body.clone().multiply(pivot(sign * 0.5, 0, 2, radians(swing * 52 * sign)));
  }
  if (!grounded) {
    poses['Right Leg'] = body.clone().multiply(pivot(0.5, 0, 2, radians(25)));
    poses['Left Leg'] = body.clone().multiply(pivot(-0.5, 0, 2, radians(-14)));
  }
  poses.HumanoidRootPart = new THREE.Matrix4();
  poses.Cape = body.clone().multiply(pivot(0, -0.55, 3.8, radians(moving ? 4 + Math.sin(runPhase) * 2 : Math.sin(simTime * 1.5) * 1.1)));
  poses.Sword = poses['Right Arm'].clone().multiply(swordBindOffset);
  let minimum = Infinity;
  for (const side of ['Right', 'Left']) {
    const bounds = CHARACTER.bootBounds[side];
    for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
      p1.set(x, y, z).applyMatrix4(poses[side + ' Leg']); minimum = Math.min(minimum, p1.z);
    }
  }
  const lift = T(0, 0, -minimum);
  for (const [n, matrix] of Object.entries(poses)) poseMatrices[n].copy(lift).multiply(matrix);
  updateImportedRig();
}
function animateCharacter(dt) {
  skinMeshes.get('Icedagger | Cyan ice and frosted edge').visible = punchTime < 0;
  if (punchTime >= 0) {
    const poses = punchPose(punchSide,punchTime,CHARACTER.bootBounds,swordBindOffset);
    const blend = THREE.MathUtils.smoothstep(punchTime,0,.055);
    for (const [name,matrix] of Object.entries(poses)) {
      if (blend < 1 && punchStartPose) {
        punchStartPose[name].decompose(position,quaternion,scaling);
        const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();matrix.decompose(p,q,s);
        poseMatrices[name].compose(position.lerp(p,blend),quaternion.slerp(q,blend),scaling.lerp(s,blend));
      } else poseMatrices[name].copy(matrix);
    }
    updateImportedRig();return;
  }
  const ability=ABILITIES[castKey];
  if (castTime >= 0 && castTime < ability.duration) {
    const f = Math.min(castTime * ability.motion.fps, ability.motion.frames - 1), index = Math.floor(f), amount = f - index;
    for (const [name, values] of Object.entries(castKey==='C'?legacyBoneData:boneData)) {
      sampleTRS(values, index, 10, amount);
      poseMatrices[name].compose(position, quaternion, scaling);
    }
    updateImportedRig();
  } else proceduralPose(dt);
}
function animateEffects() {
  const ability=ABILITIES[fxKey],ice=ability.ice;
  if (fxTime < 0 || fxTime > ability.fxDuration) { fx.visible = false; fx.userData.activeMeshes = 0; frostLight.intensity = 0; return; }
  fx.visible = true;
  for(const [key,set] of Object.entries(effectSets))set.group.visible=key===fxKey;
  const frame = Math.min(fxTime * ice.fxSampleRate, ice.fxSampleFrames.length - 1), index = Math.floor(frame), amount = frame - index;
  let visible = 0;
  for (const row of effectSets[fxKey].rows) {
    const source = row.samples;
    row.mesh.visible = source[index * 11 + 10] > 0.5;
    if (!row.mesh.visible) continue;
    sampleTRS(source, index, 11, amount); row.mesh.matrix.compose(position, quaternion, scaling);
    if (Math.max(scaling.x, scaling.y, scaling.z) > 0.005) visible++;
  }
  fx.userData.activeMeshes = visible;
  const age = fxTime - ability.impact;
  for (let i = 0; i < shockwaves.length; i++) {
    const ringAge = age - i * 0.055;
    const radius = fxKey==='V'?Math.max(0.001, Math.min(1, ringAge / 0.22) * ice.groundCircleRadius * SCALE):Math.max(.001,ringAge*(19-i*2));
    shockwaves[i].scale.setScalar(radius);
    shockwaves[i].position.set((ice.contact?.[0]||0)*SCALE,.035+i*.008,-(ice.contact?.[1]||0)*SCALE);
    shockwaves[i].material.opacity = ringAge >= 0 && ringAge < 0.7 ? Math.max(0, (1 - ringAge / 0.7) * 0.75) : 0;
  }
  const fade = 1 - THREE.MathUtils.smoothstep(fxTime, fxKey==='C'?2.35:ability.impact+1.68, ability.fxDuration);
  fxMaterial.opacity = fade;
  frostLight.position.set((ice.contact?.[0]||0)*SCALE,1.1,ice.contact?-ice.contact[1]*SCALE:-1.1);
  frostLight.intensity = age >= 0 ? 48 * Math.exp(-age * 7) : 3 + 2 * Math.sin(fxTime * 30);
}
function groundPosition(target = new THREE.Vector3()) { return target.copy(capsule.start).addScaledVector(UP, -capsule.radius); }
function teleportTo(location = spawn) {
  const offset = new THREE.Vector3().copy(location).sub(groundPosition());
  capsule.translate(offset); velocity.set(0, 0, 0); grounded = false; jumping = false;
  castTime = -1; fxTime = -1; cooldowns.C = cooldowns.V = 0; castKey = fxKey = 'V'; fx.visible = false; facing = 0; impactFired = false;
  punchTime = -1; punchStartPose = null;
  comboStep=comboQueued=0;comboExpiresAt=-Infinity;punchCooldown=0;punchInCombo=false;
  lastGroundedAt = -Infinity; coyoteAvailable = false; jumpBufferedUntil = -Infinity; runTime = 0;
  actor.position.copy(location); actor.rotation.y = 0;
}
teleportTo();
let toastExpiry = 0;
function toast(text) { $('toast').textContent = text; $('toast').classList.add('visible'); toastExpiry = simTime + 1.8; }
function castIce(key='V') {
  const ability=ABILITIES[key];
  if (!started || paused || castTime >= 0 || punchTime >= 0 || cooldowns[key] > 0) return false;
  if (!grounded) { toast('Land before using Ice slam'); return false; }
  comboStep=comboQueued=0;comboExpiresAt=-Infinity;
  castKey=fxKey=key;castTime = 0; fxTime = 0; cooldowns[key] = ability.cooldown; velocity.set(0, 0, 0);jumpBufferedUntil=-Infinity;coyoteAvailable=false;
  lockedAt.copy(groundPosition());
  fx.position.copy(lockedAt); fx.rotation.y = facing;
  impactFired = false; casts++;
  canvas.focus({ preventScroll: true });
  return true;
}
function punch(side,inCombo=false) {
  if (!started || paused || castTime >= 0 || punchTime >= 0 || punchCooldown>0 || !grounded) return false;
  if(!inCombo){comboStep=comboQueued=0;comboExpiresAt=-Infinity;}
  punchInCombo=inCombo;
  punchStartPose = Object.fromEntries(Object.entries(poseMatrices).map(([name,m])=>[name,m.clone()]));
  punchSide = side; punchTime = 0; punchesThrown[side]++;
  velocity.set(0,0,0);jumpBufferedUntil=-Infinity;coyoteAvailable=false;
  canvas.focus({preventScroll:true});return true;
}
function nextComboHit() {
  if(comboStep>=PUNCH_SEQUENCE.length)return false;
  if(!punch(PUNCH_SEQUENCE[comboStep],true))return false;
  comboStep++;return true;
}
function comboPunch() {
  if(!started||paused||!grounded||castTime>=0||punchCooldown>0)return false;
  if(punchTime>=0){
    if(!punchInCombo||comboStep+comboQueued>=PUNCH_SEQUENCE.length)return false;
    comboQueued++;return true;
  }
  if(simTime>comboExpiresAt)comboStep=0;
  return nextComboHit();
}
function finishPunch() {
  const wasCombo=punchInCombo;
  punchTime=-1;punchStartPose=null;punchInCombo=false;
  if(wasCombo&&comboQueued>0&&comboStep<PUNCH_SEQUENCE.length){comboQueued--;nextComboHit();return;}
  if(!wasCombo||comboStep===PUNCH_SEQUENCE.length){
    punchCooldown=PUNCH_COOLDOWN;comboStep=comboQueued=0;comboExpiresAt=-Infinity;
  }else comboExpiresAt=simTime+COMBO_WINDOW;
}
const desired = new THREE.Vector3(), delta = new THREE.Vector3();
function simulate(dt) {
  if (!started || paused) return;
  simTime += dt; for(const key of ['C','V'])cooldowns[key]=Math.max(0,cooldowns[key]-dt);
  punchCooldown=Math.max(0,punchCooldown-dt);
  if(punchTime<0&&comboStep>0&&simTime>comboExpiresAt){comboStep=comboQueued=0;}
  if (castTime >= 0) {
    castTime += dt;
    velocity.set(0, 0, 0);
    if (!impactFired && castTime >= ABILITIES[castKey].impact) { shake = 0.105; impactFired = true; }
    if (castTime >= ABILITIES[castKey].duration) castTime = -1;
  } else if (punchTime >= 0) {
    punchTime += dt; velocity.set(0,0,0);
    if (punchTime >= PUNCHES[punchSide].duration) {
      // Capture the outgoing recovery before blending into a buffered hit.
      animateCharacter(0);finishPunch();
    }
  } else {
    consumeJump();
    desired.set(0, 0, 0);
    let forward = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    let right = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    desired.set(-Math.sin(cameraYaw) * forward + Math.cos(cameraYaw) * right, 0, -Math.cos(cameraYaw) * forward - Math.sin(cameraYaw) * right);
    if (desired.lengthSq()) desired.normalize().multiplyScalar(MOVE_SPEED);
    // Direct camera-relative velocity, with immediate air vectoring.
    // Releasing input in the air retains the current jump momentum.
    if(grounded||desired.lengthSq()>0){velocity.x=desired.x;velocity.z=desired.z;}
    velocity.y = Math.max(-32, velocity.y - 23 * dt);
    delta.copy(velocity).multiplyScalar(dt); capsule.translate(delta);
    grounded = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      const collision = world.capsuleIntersect(capsule);
      if (!collision) break;
      if (collision.normal.y > 0.45 && (!jumping || velocity.y <= 0)) { grounded = true; jumping = false; }
      const into = collision.normal.dot(velocity);
      if (into < 0) velocity.addScaledVector(collision.normal, -into);
      capsule.translate(collision.normal.multiplyScalar(collision.depth + 0.00005));
    }
    // Keep shallow floor seams and ramp crests from toggling ground contact.
    if(!grounded&&velocity.y<=0){
      groundProbe.copy(capsule);groundProbe.translate(new THREE.Vector3(0,-.075,0));
      const support=world.capsuleIntersect(groundProbe);
      if(support&&support.normal.y>.45){
        const down=.075-support.depth/support.normal.y;
        if(down>=-.005&&down<=.075){capsule.translate(new THREE.Vector3(0,-Math.max(0,down),0));grounded=true;jumping=false;}
      }
    }
    if (grounded && velocity.y < 0.1) velocity.y = 0;
    if(grounded){lastGroundedAt=simTime;coyoteAvailable=true;consumeJump();}
    if (shiftLocked || desired.lengthSq() > 0.1) {
      const target = shiftLocked ? cameraYaw : Math.atan2(-desired.x, -desired.z);
      const turn = Math.atan2(Math.sin(target - facing), Math.cos(target - facing));
      facing += turn * (1 - Math.exp(-TURN_RESPONSE * dt));
      facing = Math.atan2(Math.sin(facing), Math.cos(facing));
    }
  }
  if (fxTime >= 0) { fxTime += dt; if (fxTime > ABILITIES[fxKey].fxDuration) fxTime = -1; }
  actor.position.copy(groundPosition()); actor.rotation.y = facing;
  if (actor.position.y < -5 || Math.abs(actor.position.x) > arena.halfSize+5 || Math.abs(actor.position.z) > arena.halfSize+5) { teleportTo(); toast('Back at arena spawn'); }
  shake *= Math.exp(-17 * dt);
  animateCharacter(dt); animateEffects(); updateHUD();
}
function consumeJump(){
  if(castTime>=0||punchTime>=0||jumpBufferedUntil<simTime)return;
  if(grounded||(coyoteAvailable&&simTime-lastGroundedAt<=COYOTE_TIME)){
    velocity.y=8.2;grounded=false;jumping=true;coyoteAvailable=false;lastGroundedAt=-Infinity;jumpBufferedUntil=-Infinity;jumps++;
  }
}
function jump() {
  if(started&&!paused&&castTime<0&&punchTime<0){jumpBufferedUntil=simTime+JUMP_BUFFER;consumeJump();}
}
const cameraTarget = new THREE.Vector3(), cameraPos = new THREE.Vector3(), ray = new THREE.Ray();
let cameraInitialized = false;
function updateCamera(dt) {
  const target = actor.position.clone().add(new THREE.Vector3(0, 1.6, 0));
  if (shiftLocked) target.add(new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw)).multiplyScalar(.65));
  if (!cameraInitialized) { cameraTarget.copy(target); cameraInitialized = true; }
  cameraTarget.lerp(target, 1 - Math.exp(-16 * Math.max(dt, 0.0001)));
  const horizontal = Math.cos(cameraPitch) * cameraDistance;
  const offset = new THREE.Vector3(Math.sin(cameraYaw) * horizontal, Math.sin(cameraPitch) * cameraDistance, Math.cos(cameraYaw) * horizontal);
  ray.set(cameraTarget, offset.clone().normalize());
  const hit = world.rayIntersect(ray);
  let distance = cameraDistance;
  if (hit && hit.distance < distance) distance = Math.max(.6,hit.distance-.2);
  cameraPos.copy(cameraTarget).addScaledVector(offset.normalize(), distance);
  if (shake > 0.001) cameraPos.add(new THREE.Vector3(Math.sin(simTime * 111), Math.cos(simTime * 137), Math.sin(simTime * 97)).multiplyScalar(shake));
  camera.position.copy(cameraPos); camera.lookAt(cameraTarget);
}
function updateHUD() {
  const casting = castTime >= 0, punching = punchTime >= 0;
  $('combo-status').textContent=punchCooldown>0?`PUNCH COMBO · ${punchCooldown.toFixed(1)}s`:punchInCombo?`PUNCH COMBO · ${comboStep} / 4`:comboStep>0?`COMBO · ${comboStep} / 4 · CLICK FOR ${PUNCH_SEQUENCE[comboStep].toUpperCase()}`:'CLICK · R → L → R → L';
  $('combo-status').classList.toggle('cooling',punchCooldown>0);
  $('ability-state').textContent = punching ? PUNCHES[punchSide].label : casting ? `${ABILITIES[castKey].label} · ${castTime<ABILITIES[castKey].impact?'Wind-up':'Recovery'}` : 'C · Ice stomp / V · Massive slam';
  for(const key of ['C','V']){
    $(key==='V'?'cast':'cast-c').setAttribute('aria-disabled',String(casting||punching||cooldowns[key]>0));
    $(key==='V'?'cooldown-cover':'cooldown-cover-c').style.transform=`scaleY(${cooldowns[key]/ABILITIES[key].cooldown})`;
    $(key==='V'?'cooldown-time':'cooldown-time-c').textContent=cooldowns[key]>0?`${Math.ceil(cooldowns[key])}s`:'';
  }
  $('ability-meter-fill').style.transform = `scaleX(${1 - cooldowns[castKey] / ABILITIES[castKey].cooldown})`;
  document.querySelector('.ability-panel').classList.toggle('casting', casting);
  if (simTime > toastExpiry) $('toast').classList.remove('visible');
}
function start() {
  started = true; paused = false; $('welcome').classList.add('hidden'); canvas.focus({ preventScroll: true });
}
$('start').addEventListener('click', start);
$('cast').addEventListener('click', ()=>castIce('V'));
$('cast-c').addEventListener('click',()=>castIce('C'));
function captureMouse() {
  try {
    const request = canvas.requestPointerLock?.();
    request?.catch(() => { if (shiftLocked) toast('Click the arena to capture the mouse'); });
  } catch { if (shiftLocked) toast('Click the arena to capture the mouse'); }
}
function setShiftLock(enabled) {
  shiftLocked = enabled; dragging = false;
  document.body.classList.toggle('shift-locked', enabled);
  $('shift-lock').setAttribute('aria-pressed', String(enabled));
  if (enabled) { canvas.focus({ preventScroll: true }); captureMouse(); }
  else if (document.pointerLockElement === canvas) document.exitPointerLock();
}
$('shift-lock').addEventListener('click', () => { if (started && !paused) setShiftLock(!shiftLocked); });
$('help').addEventListener('click', () => { paused = true; keys.clear(); setShiftLock(false); $('welcome').classList.remove('hidden'); $('start').firstChild.textContent = 'Return to arena '; });
window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (!e.repeat) {
    if (e.code === 'KeyV') castIce();
    if (e.code === 'KeyC') castIce('C');
    if (e.code === 'KeyZ') punch('Left');
    if (e.code === 'KeyX') punch('Right');
    if (e.code === 'Space') jump();
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && started && !paused) setShiftLock(!shiftLocked);
    if (e.code === 'Escape' && shiftLocked) setShiftLock(false);
    if (e.code === 'KeyR' && started) { teleportTo(); toast('Reset to the arena'); }
    if (e.code === 'Enter' && !started) start();
    if (e.code === 'Escape' && paused) start();
  }
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); setShiftLock(false); });
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (pointerWasLocked && !locked) setShiftLock(false);
  pointerWasLocked = locked;
});
canvas.addEventListener('pointerdown', e => {
  if(!started||paused)return;canvas.focus({preventScroll:true});
  if(shiftLocked&&document.pointerLockElement!==canvas)captureMouse();
  if(e.button===0){comboPunch();return;}
  if(e.button===2&&!shiftLocked){dragging=true;canvas.setPointerCapture(e.pointerId);}
});
canvas.addEventListener('pointerup', e => { if(e.button!==2)return;dragging = false; if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); });
canvas.addEventListener('pointercancel', () => dragging = false);
document.addEventListener('mousemove', e => {
  if (!started || paused || !(dragging || document.pointerLockElement === canvas || (shiftLocked && e.target === canvas))) return;
  cameraYaw -= e.movementX * 0.006;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch + e.movementY * 0.004, -0.1, 1.15);
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { e.preventDefault(); cameraDistance = THREE.MathUtils.clamp(cameraDistance + e.deltaY * 0.005, 2.4, 11.5); }, { passive: false });
window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
let previousFrame = performance.now();
function render() { updateCamera(1 / 60); renderer.render(scene, camera); }
function frame(now) {
  const dt = Math.min(0.06, (now - previousFrame) / 1000); previousFrame = now;
  if (!TEST) {
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let i = 0; i < steps; i++) simulate(dt / steps);
    updateCamera(dt); renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
proceduralPose(0); actor.position.copy(spawn); updateCamera(1); renderer.render(scene, camera);
$('loading').classList.add('hidden'); $('welcome').classList.remove('hidden');
window.__iceGame = {
  ready: true,
  getState() { return { position: actor.position.toArray(), facing, grounded, locked: castTime >= 0 || punchTime >= 0, activePunch:punchTime>=0?punchSide:null, punchTime, comboStep,comboQueued,punchCooldown,punchInCombo,comboWindow:COMBO_WINDOW,comboCooldownDuration:PUNCH_COOLDOWN, cooldownDurations:{C:ABILITIES.C.cooldown,V:ABILITIES.V.cooldown}, punchesThrown:{...punchesThrown}, punchDuration:PUNCHES[punchSide].duration, punchImpact:PUNCHES[punchSide].impact, animationTime: castTime, cooldown: cooldowns[castKey], cooldowns: {...cooldowns}, activeAbility: castTime>=0?castKey:null, fxAbility:fxKey, casts, activeIceMeshes: fx.userData.activeMeshes || 0, fxVisible: fx.visible, mapName: arena.group.name, mapTriangles:arena.triangles, collisionTriangles:arena.collisionTriangles, arenaHalfSize:arena.halfSize, shiftLocked, pointerLocked:document.pointerLockElement===canvas, cameraYaw, cameraPitch, cameraDistance, cameraPosition:camera.position.toArray(), velocity:velocity.toArray(), simTime, coyoteRemaining: coyoteAvailable?Math.max(0,COYOTE_TIME-(simTime-lastGroundedAt)):0, jumps, runAnimation:RUN.source, runAnimationTime:runTime, arenaWallCount:arena.wallCount, torsoPose: poseMatrices.Torso.toArray(), characterName: CHARACTER.name, importedBones: importedBones.length, importedSkinMeshes: skinMeshes.size, sourceCharacterMeshes: CHARACTER.sourceMeshCount, weaponGripError: new THREE.Vector3(...CHARACTER.swordGrip).applyMatrix4(poseMatrices.Sword).distanceTo(new THREE.Vector3(...CHARACTER.rightPalm).applyMatrix4(poseMatrices['Right Arm'])), pinPillars: 0, spikeCount: ICE.spikeCount, impactTime: IMPACT, castDuration: CAST_DURATION, abilityKey: "V", renderer: renderer.info.render, started }; },
  ...(TEST ? {
    verifyImportedSkin,
    inspectPose() { return Object.fromEntries(Object.entries(poseMatrices).map(([name,matrix])=>[name,matrix.toArray()])); },
    inspectIceFists() {
      character.updateWorldMatrix(true,true);
      return Object.fromEntries(Object.entries(iceFists).map(([side,group])=>{
        const actual=group.getWorldPosition(new THREE.Vector3());
        const expected=new THREE.Vector3(...FIST_ANCHORS[side]).applyMatrix4(poseMatrices[side+' Arm']).applyMatrix4(character.matrixWorld);
        return [side,{visible:group.visible,crystals:7,position:actual.toArray(),attachmentError:actual.distanceTo(expected)}];
      }));
    },
    raycast(origin,direction) { const hit=world.rayIntersect(new THREE.Ray(new THREE.Vector3(...origin),new THREE.Vector3(...direction).normalize()));return hit?{distance:hit.distance,point:hit.position?.toArray()}:null; },
    advance(seconds) { const n = Math.ceil(seconds * 120); for (let i = 0; i < n; i++) { simulate(seconds / n); updateCamera(seconds / n); } render(); return this.getState(); },
    teleport(x, y, z) { teleportTo(new THREE.Vector3(x, y, z)); cameraInitialized = false; render(); },
    view(yaw, pitch, distance) { cameraYaw = yaw; cameraPitch = pitch; cameraDistance = distance; cameraInitialized = false; render(); }
  } : {})
};
requestAnimationFrame(frame);
