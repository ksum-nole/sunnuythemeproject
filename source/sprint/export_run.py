import bpy,json,base64,array
from pathlib import Path
from mathutils import Matrix
P=Path('/Users/jacobatamas/Desktop/Ice_Slam_Web_Game');s=bpy.context.scene;r=bpy.data.objects['R6 Sprint Rig'];rest={b.name:b.matrix_local.copy()for b in r.data.bones};start,end=map(int,r.animation_data.action.frame_range);fps=s.render.fps/s.render.fps_base;clips={n:[]for n in rest};matrices=[]
for f in range(start,end+1):
 s.frame_set(f);bpy.context.view_layer.update();row={}
 for n in rest:
  m=r.pose.bones[n].matrix@rest[n].inverted();row[n]=[list(a)for a in m];p,q,scale=m.decompose();clips[n].extend([*p,q.x,q.y,q.z,q.w,*scale])
 matrices.append(row)
def pack(v):return base64.b64encode(array.array('f',v).tobytes()).decode()
result={'name':'Pure Sprint','source':'Pure_Sprint_Animation.blend','fps':fps,'frames':end-start+1,'duration':(end-start)/fps,'sourceRange':[start,end],'clip':{n:pack(v)for n,v in clips.items()}}
(P/'dist/assets/run.json').write_text(json.dumps(result,separators=(',',':')))
seam=max(abs(matrices[0][n][i][j]-matrices[-1][n][i][j]) for n in rest for i in range(4)for j in range(4));print('SPRINT_EXPORT',result['frames'],fps,'seam',seam,flush=True)
(P/'reviews/movement/run-source.json').write_text(json.dumps({'source':result['source'],'fps':fps,'frames':result['frames'],'duration':result['duration'],'sourceRange':[start,end],'loopSeamMatrixError':seam,'sampleDeformations':{str(i):matrices[i]for i in [0,4,8,12,16]}},indent=2))
