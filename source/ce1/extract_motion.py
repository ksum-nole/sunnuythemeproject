from pathlib import Path
import json,numpy as np
from scipy.spatial.transform import Rotation
P=Path('/Users/jacobatamas/Desktop/Ice_Slam_Web_Game');nodes={int(k):v for k,v in json.loads((P/'reviews/ce1/place-nodes.json').read_text()).items()};children={}
for k,v in nodes.items():children.setdefault(v.get('parent'),[]).append(k)
def cf(d):
 r=d['R']
 if isinstance(r,dict):
  j=r['rotation_id']-1;axes=np.array([[1,0,0],[0,1,0],[0,0,1],[-1,0,0],[0,-1,0],[0,0,-1]]);x,y=axes[j//6],axes[j%6];rot=np.column_stack([x,y,np.cross(x,y)])
 else:rot=np.array(r).reshape(3,3)
 m=np.eye(4);m[:3,:3]=rot;m[:3,3]=d['p'];return m
def T(p):m=np.eye(4);m[:3,3]=p;return m
motors={nodes[v['props']['Part1']]['props']['Name']:{'parent':nodes[v['props']['Part0']]['props']['Name'],'c0':cf(v['props']['C0']),'c1':cf(v['props']['C1'])}for v in nodes.values()if v['class']=='Motor6D'}
centers={'HumanoidRootPart':(0,0,3),'Torso':(0,0,3),'Head':(0,0,4.5),'Right Arm':(1.5,0,3),'Left Arm':(-1.5,0,3),'Right Leg':(.5,0,1),'Left Leg':(-.5,0,1)}
B=np.array([[1,0,0,0],[0,0,-1,0],[0,1,0,0],[0,0,0,1.]])
keys=sorted([k for k,v in nodes.items()if v['class']=='Keyframe'],key=lambda k:nodes[k]['props']['Time']);frames=[]
for k in keys:
 poses={}
 def visit(ref):
  v=nodes[ref]
  if v['class']=='Pose':poses[v['props']['Name']]=cf(v['props']['CFrame'])
  for c in children.get(ref,[]):visit(c)
 visit(k);world={'HumanoidRootPart':T([0,3,0])@poses.get('HumanoidRootPart',np.eye(4))}
 for name in ['Torso','Head','Right Arm','Left Arm','Right Leg','Left Leg']:
  a=motors[name];world[name]=world[a['parent']]@a['c0']@poses.get(name,np.eye(4))@np.linalg.inv(a['c1'])
 out={n:B@v@np.linalg.inv(B)@T(-np.array(centers[n]))for n,v in world.items()}
 frames.append({n:v.tolist()for n,v in out.items()})
(P/'source/ce1/source-motion.json').write_text(json.dumps({'fps':60,'frames':frames},separators=(',',':')))
for i in range(0,len(frames),10):
 f={n:np.array(v)for n,v in frames[i].items()};print(i,'Rfoot',np.round((f['Right Leg']@np.array([.5,0,0,1]))[:3],2),'hands',[(n,np.round((f[n]@np.array([centers[n][0],0,2,1]))[:3],2).tolist())for n in ['Right Arm','Left Arm']])
print('Frames',len(frames),'duration',(len(frames)-1)/60)
