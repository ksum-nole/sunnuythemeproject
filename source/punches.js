import * as THREE from 'three';

export const PUNCHES = {
  Left: { label: 'Left punch', duration: .58, impact: .232, power: .78 },
  Right: { label: 'Right cross', duration: .70, impact: .280, power: 1 }
};

// Phase, hip yaw, chest yaw, shoulder pitch, guard pitch, forward lean,
// weight transfer, compression, forward arm alignment.
const keys = [
  [0,     0,   0,   0,  0,   0,     0,     0,  0],
  [.13,  -6, -10,  55, 46,   1, -.025, -.035,  0],
  [.26, -14, -26,  62, 72,   4, -.065, -.095, .05],
  [.34,  32,  52,  83, 77,  -5,   .31,  -.06, .68],
  [.40,  54,  88,  90, 83,  -9,   .68,  -.12,  1],
  [.46,  58,  90,  90, 80, -10,   .76,   -.1,  1],
  [.59,  25,  36,  82, 75,  -5,   .29,  -.04, .55],
  [.76,  -3,  -5,  40, 40,   0,     0,     0, .03],
  [1,     0,   0,   0,  0,   0,     0,     0,  0]
];

// Monotone cubic curves avoid both keyframe stops and angle overshoot.
function sample(phase, column) {
  let i = 0;
  while (i < keys.length - 2 && phase > keys[i + 1][0]) i++;
  const slope = j => (keys[j + 1][column] - keys[j][column]) / (keys[j + 1][0] - keys[j][0]);
  const tangent = j => {
    if (j === 0 || j === keys.length - 1) return 0;
    const a = slope(j - 1), b = slope(j);
    if (a * b <= 0) return 0;
    const h0 = keys[j][0] - keys[j - 1][0], h1 = keys[j + 1][0] - keys[j][0];
    const w0 = 2 * h1 + h0, w1 = h1 + 2 * h0;
    return (w0 + w1) / (w0 / a + w1 / b);
  };
  const a = keys[i], b = keys[i + 1], h = b[0] - a[0], t = (phase - a[0]) / h;
  return (2*t*t*t-3*t*t+1)*a[column] + (t*t*t-2*t*t+t)*h*tangent(i)
    + (-2*t*t*t+3*t*t)*b[column] + (t*t*t-t*t)*h*tangent(i + 1);
}
const rad = THREE.MathUtils.degToRad;
const translate = (x=0,y=0,z=0) => new THREE.Matrix4().makeTranslation(x,y,z);
function pivot(x,y,z,rx=0,ry=0,rz=0) {
  return translate(x,y,z).multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rad(rx),rad(ry),rad(rz),'XYZ'))).multiply(translate(-x,-y,-z));
}

export function punchPose(side, seconds, bootBounds, swordBindOffset) {
  const config = PUNCHES[side], sign = side === 'Right' ? 1 : -1;
  const phase = THREE.MathUtils.clamp(seconds / config.duration, 0, 1);
  const v = n => sample(phase,n), power = config.power;
  const envelope = Math.sin(Math.PI * phase) ** 2;
  const hip = sign*v(1), chest = sign*v(2);
  const base = translate(-sign*.07*envelope,v(6)*power,v(7));
  const hips = base.clone().multiply(pivot(0,0,2,0,0,hip));
  const torso = hips.clone().multiply(pivot(0,0,2,v(5),0,chest-hip));
  const poses = {
    HumanoidRootPart: new THREE.Matrix4(),
    Torso: torso,
    Head: torso.clone().multiply(pivot(0,0,4,-v(5)*.65,0,-chest*.78))
  };
  for (const [limb,s] of [['Right',1],['Left',-1]]) {
    const striking = limb === side;
    const idlePitch = limb === 'Right' ? 9 : 0;
    const pitch = (striking ? v(3) : v(4)) + idlePitch*(1-envelope);
    const shoulderX = s*(striking?1.5:1.05);
    const shoulder = new THREE.Vector3(shoulderX,0,3.5).applyMatrix4(torso);
    const rotation = new THREE.Quaternion().setFromRotationMatrix(torso)
      .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(pitch),0,rad(-s*(striking?5:13)*envelope),'XYZ')));
    const forward = new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(striking?90:128),0,rad(striking?0:-s*18),'XYZ'));
    rotation.slerp(forward,v(8));
    poses[limb+' Arm'] = translate(...shoulder.toArray())
      .multiply(new THREE.Matrix4().makeRotationFromQuaternion(rotation))
      .multiply(translate(-shoulderX,0,-3.5));
    // Keep the feet planted horizontally while the hips rotate above them.
    // R6 limbs stay single rigid pieces: there are no invented elbows or knees.
    poses[limb+' Leg'] = base.clone().multiply(translate(0,(s===-1?.16:-.12)*envelope,0))
      .multiply(pivot(s*.5,0,2,(s===sign?5:-3)*envelope,0,(s===sign?hip*.7:hip*.18)));
  }
  poses.Cape = torso.clone().multiply(pivot(0,-.55,3.8,-v(5)*.28,0,-chest*.15));
  poses.Sword = poses['Right Arm'].clone().multiply(swordBindOffset);
  let lowest = Infinity;
  const point = new THREE.Vector3();
  for (const limb of ['Right','Left']) {
    const bounds = bootBounds[limb];
    for (const x of [bounds.min[0],bounds.max[0]]) for (const y of [bounds.min[1],bounds.max[1]]) for (const z of [bounds.min[2],bounds.max[2]]) {
      lowest = Math.min(lowest,point.set(x,y,z).applyMatrix4(poses[limb+' Leg']).z);
    }
  }
  const lift = translate(0,0,-lowest);
  for (const matrix of Object.values(poses)) matrix.premultiply(lift);
  return poses;
}
