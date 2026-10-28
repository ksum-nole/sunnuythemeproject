from pathlib import Path
import json,numpy as np,base64,array
from scipy.spatial.transform import Rotation,Slerp
P=Path('/Users/jacobatamas/Desktop/Ice_Slam_Web_Game');raw=json.loads((P/'source/ce1/source-motion.json').read_text())['frames'];character=json.loads((P/'dist/assets/itrapped.json').read_text())
def M(v):return np.array(v).reshape((4,4),order='F')
grip=np.linalg.inv(M(character['idle']['Right Arm']))@M(character['idle']['Sword'])
# Readable startup; every frame from source 90 onward stays at original speed.
samples=list(np.linspace(0,60,79))+list(np.linspace(60,90,39))[1:]+list(range(91,len(raw)))
poses=[]
for source in samples:
 a=int(source);b=min(a+1,len(raw)-1);u=source-a;f={}
 for name in raw[0]:
  ma=np.array(raw[a][name]);mb=np.array(raw[b][name]);r=Slerp([0,1],Rotation.from_matrix([ma[:3,:3],mb[:3,:3]]))([u]).as_matrix()[0];m=np.eye(4);m[:3,:3]=r;m[:3,3]=ma[:3,3]*(1-u)+mb[:3,3]*u;f[name]=m
 f['Cape']=f['Torso'].copy();f['Sword']=f['Right Arm']@grip;poses.append({n:v.tolist()for n,v in f.items()})
hit=samples.index(94);contact=(np.array(poses[hit]['Right Arm'])@np.array([1.5,0,2,1]))[:3];contact[2]=0
out={'fps':60,'poses':poses,'sourceFrames':samples,'impactFrame':hit,'downstrikeSourceFrames':[91,92,93,94],'downstrikeFrames':[samples.index(x)for x in [91,92,93,94]],'contact':contact.tolist(),'duration':(len(poses)-1)/60,'source':'Desktop/Place1.rbxl > KeyframeSequence'}
(P/'source/ce1/motion.json').write_text(json.dumps(out,separators=(',',':')))
for name in character['clip']:
 values=[]
 for f in poses:
  m=np.array(f[name]);values.extend([*m[:3,3],*Rotation.from_matrix(m[:3,:3]).as_quat(),1,1,1])
 character['clip'][name]=base64.b64encode(array.array('f',values).tobytes()).decode()
character['frames']=len(poses);character['sourceAnimation']=out['source'];character['impactFrame']=hit
# Independent skin references from the source deformations and original skin weights.
groups={g['material']['name']:g for g in character['groups']}
refs=[]
for frame in [0,hit-3,hit]:
 items=[]
 for old in character['references'][0]['samples']:
  g=groups[old['group']];i=old['index'];v=np.frombuffer(base64.b64decode(g['vertices']),dtype=np.float32).reshape(-1,9)[i,:3];idx=np.frombuffer(base64.b64decode(g['skinIndex']),dtype=np.uint8).reshape(-1,4)[i];w=np.frombuffer(base64.b64decode(g['skinWeight']),dtype=np.float32).reshape(-1,4)[i];point=sum((np.array(poses[frame][character['bones'][int(b)]['name']])@np.r_[v,1])[:3]*float(weight) for b,weight in zip(idx,w));items.append(dict(old,point=point.tolist()))
 refs.append({'frame':frame,'samples':items})
character['references']=refs
(P/'dist/assets/itrapped.json').write_text(json.dumps(character,separators=(',',':')))
(P/'reviews/ce1/timing.json').write_text(json.dumps({k:v for k,v in out.items()if k!='poses'},indent=2));print('TIMING',len(poses),'impact',hit,'startup',hit/60,'original',94/60,'downstroke 3 frames preserved',contact)
