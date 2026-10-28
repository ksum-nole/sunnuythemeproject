import * as THREE from 'three';

export const PUNCHES = {
  Left: { label: 'Left punch', duration: 1.10, impact: .462, power: .78 },
  Right: { label: 'Right cross', duration: 1.30, impact: .546, power: 1 }
};

// Phase, hip yaw, chest yaw, shoulder pitch, guard pitch, forward lean,
// weight transfer, compression, forward arm alignment.
const keys = [
  [0,     0,   0,   0,  0,   0,     0,     0,  0],
  [.13,  -6, -10,  55, 46,   1, -.025, -.035,  0],
  [.26, -18, -26,  62, 72,   4, -.065, -.095, .05],
  [.34,  55,  48,  83, 77,  -4,   .31,  -.06, .68],
  [.42,  90,  90,  90, 83,  -5,   .76,  -.10,  1],
  [.60,  90,  90,  90, 83,  -6,   .84,  -.08,  1],
  [.74,  38,  46,  78, 75,  -4,   .29,  -.04, .55],
  [.86,  -3,  -5,  40, 40,   0,     0,     0, .03],
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
    // At full extension, hinge at the top of the rigid upper arm so the
    // entire arm reaches forward instead of leaving part behind the shoulder.
    const shoulderZ = 3.5+(striking?.45*v(8):0);
    const shoulder = new THREE.Vector3(shoulderX,0,shoulderZ).applyMatrix4(torso);
    const rotation = new THREE.Quaternion().setFromRotationMatrix(torso)
      .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(pitch),0,rad(-s*(striking?5:13)*envelope),'XYZ')));
    const forward = new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(striking?90:128),0,rad(striking?0:-s*18),'XYZ'));
    rotation.slerp(forward,v(8));
    poses[limb+' Arm'] = translate(...shoulder.toArray())
      .multiply(new THREE.Matrix4().makeRotationFromQuaternion(rotation))
      .multiply(translate(-shoulderX,0,-shoulderZ));
    // The complete lower body turns with the pelvis into a staggered blade.
    // A slight foot counter-turn keeps the lead foot angled toward the strike.
    poses[limb+' Leg'] = hips.clone().multiply(translate(s*.22*envelope,0,0))
      .multiply(pivot(s*.5,0,2,(s===sign?5:-3)*envelope,0,-hip*(s===sign?.25:.05)));
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
