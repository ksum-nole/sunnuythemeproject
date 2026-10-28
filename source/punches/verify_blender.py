import bpy,json,math
from pathlib import Path
from mathutils import Matrix
P=Path('/Users/jacobatamas/Desktop/Ice_Slam_Web_Game');data=json.loads((P/'source/punches/poses.json').read_text());r=bpy.data.objects['Itrapped | Power punches'];report={'actions':[],'maximumMatrixError':0}
assert len(r.data.bones)==9
for side,start in [('Left',15),('Right',90)]:
 clip=data['actions'][side];assert len([a for a in bpy.data.actions if side in a.name])==1
 for index in [0,round((clip['frames']-1)*.26),round((clip['frames']-1)*.4),clip['frames']-1]:
  frame=start+index/(clip['frames']-1)*clip['duration']*60;bpy.context.scene.frame_set(math.floor(frame),subframe=frame%1);bpy.context.view_layer.update()
  for name,values in clip['poses'][index].items():
   actual=r.pose.bones[name].matrix@r.data.bones[name].matrix_local.inverted();expected=Matrix([values[i::4]for i in range(4)]);error=max(abs(actual[i][j]-expected[i][j])for i in range(4)for j in range(4));report['maximumMatrixError']=max(report['maximumMatrixError'],error)
 report['actions'].append({'side':side,'duration':clip['duration'],'samples':clip['frames']})
assert report['maximumMatrixError']<.0001,report
report['status']='PASS';(P/'reviews/punches/blender-validation.json').write_text(json.dumps(report,indent=2));print('PUNCH_BLENDER_VALIDATED',json.dumps(report),flush=True)
