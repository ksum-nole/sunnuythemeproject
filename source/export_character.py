"""Import Itrapped's actual Blender skin, bone hierarchy and native stomp.
No character geometry is reconstructed. Map and source Blender files stay untouched.
"""
import bpy,json,math,base64,array
from pathlib import Path
from mathutils import Matrix,Vector
Q=Path('/Users/jacobatamas/Desktop/Ice_Slam_Web_Game');A=Q/'dist/assets';SOURCE=Path('/Users/jacobatamas/blender_models/teaser_team_combo/ice_ability_solo/Itrapped_Ice_Ability_Solo.blend')
def pack(vals,kind='f'):return base64.b64encode(array.array(kind,vals).tobytes()).decode()
def columns(m):return [m[i][j]for j in range(4)for i in range(4)]
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));s=bpy.context.scene;r=bpy.data.objects['Ice Crown | R6 rig'];s.frame_set(0);bpy.context.view_layer.update();placement=bpy.data.objects['PLACEMENT | Finalized ice slam'].matrix_world.copy();canonical=placement.inverted();rest={b.name:b.matrix_local.copy()for b in r.data.bones};bn=list(rest);bi={n:i for i,n in enumerate(bn)}
parts=[o for o in s.objects if o.type=='MESH'and any(m.type=='ARMATURE'and m.object==r for m in o.modifiers)];groups={};samples=[];states=[]
for o in parts:
 for m in o.modifiers:
  if m.type=='ARMATURE':states.append((m,m.show_viewport));m.show_viewport=False
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
for o in parts:
 ev=o.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles();W=r.matrix_world.inverted()@o.matrix_world;N=W.to_3x3().inverted().transposed();slots=[x.material for x in o.material_slots];vg={g.index:g.name for g in o.vertex_groups};uv=me.uv_layers.active
 flip=sum(me.vertices[t.vertices[0]].co.dot(me.vertices[t.vertices[1]].co.cross(me.vertices[t.vertices[2]].co))for t in me.loop_triangles)<-1e-6
 chosen=False
 for t in me.loop_triangles:
  mat=slots[min(t.material_index,len(slots)-1)]if slots else None;key=mat.name if mat else'Default';bs=mat.node_tree.nodes.get('Principled BSDF')if mat and mat.node_tree else None
  if key not in groups:
   color=list(mat.diffuse_color[:3])if mat else[.5,.5,.5];material={'name':key,'metalness':float(bs.inputs['Metallic'].default_value)if bs else 0,'roughness':float(bs.inputs['Roughness'].default_value)if bs else .6,'emission':list(bs.inputs['Emission Color'].default_value[:3])if bs else[0,0,0],'emissionStrength':float(bs.inputs['Emission Strength'].default_value)if bs else 0,'texture':None}
   if bs and bs.inputs['Base Color'].is_linked:
    image=next((n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE'and n.image),None)
    if image:
     data=bytes(image.packed_file.data)if image.packed_file else Path(bpy.path.abspath(image.filepath)).read_bytes();mime='image/png'if data[:4]==b'\x89PNG'else'image/jpeg';material['texture']='data:'+mime+';base64,'+base64.b64encode(data).decode();color=[1,1,1]
   groups[key]={'material':material,'color':color,'vertices':[],'uv':[],'skinIndex':[],'skinWeight':[],'indices':[],'lookup':{}}
  g=groups[key]
  for li in (tuple(reversed(t.loops))if flip else t.loops):
   vi=me.loops[li].vertex_index;v=me.vertices[vi];p=W@v.co;n=(N@me.corner_normals[li].vector).normalized()*(-1 if flip else 1);tex=list(uv.data[li].uv)if uv else[0,0];weights=sorted([(bi[vg[x.group]],float(x.weight))for x in v.groups if vg.get(x.group)in bi and x.weight>1e-8],key=lambda x:-x[1])[:4]
   if not weights:
    name=o.get('R6 part')or next((x for x in vg.values()if x in bi),'Torso');weights=[(bi[name],1)]
   total=sum(w for _,w in weights);idx=[i for i,_ in weights]+[0]*(4-len(weights));wt=[w/total for _,w in weights]+[0]*(4-len(weights));values=[*p,*n,*g['color']];vk=tuple(round(x,6)for x in values+tex+idx+wt);index=g['lookup'].get(vk)
   if index is None:
    index=len(g['vertices'])//9;g['lookup'][vk]=index;g['vertices'].extend(values);g['uv'].extend(tex);g['skinIndex'].extend(idx);g['skinWeight'].extend(wt)
   g['indices'].append(index)
   if not chosen and any(x in o.name for x in ['Armored chest','Crown blade','black gauntlet','Long slate cape','Classic Roblox native mesh','boot']):samples.append({'object':o.name,'vertex':vi,'group':key,'index':index});chosen=True
 ev.to_mesh_clear()
for m,visible in states:m.show_viewport=visible
bpy.context.view_layer.update()
references=[]
for frame in [0,30,57]:
 s.frame_set(frame);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();row=[]
 for sample in samples:
  o=bpy.data.objects[sample['object']];ev=o.evaluated_get(deps);me=ev.to_mesh();point=canonical@ev.matrix_world@me.vertices[sample['vertex']].co;row.append({'group':sample['group'],'index':sample['index'],'point':list(point)});ev.to_mesh_clear()
 references.append({'frame':frame,'samples':row})
poses=json.loads(Path('/Users/jacobatamas/blender_models/teaser_team_combo/source/ice_latest.json').read_text())['poses'];clip={};idle={}
for n in bn:
 source='Torso'if n=='Cape'else n;values=[]
 for f in range(1,119):
  M=Matrix(poses[str(f)][source]);p,q,sc=M.decompose();values.extend([*p,q.x,q.y,q.z,q.w,*sc])
 clip[n]=pack(values);idle[n]=columns(Matrix(poses['1'][source]))
result={'name':'Itrapped','source':str(SOURCE),'rigName':r.name,'sourceMeshCount':len(parts),'bones':[{'name':b.name,'parent':b.parent.name if b.parent else None,'rest':columns(b.matrix_local),'head':list(b.head_local)}for b in r.data.bones],'groups':[],'clip':clip,'idle':idle,'frames':118,'fps':60,'references':references,'rightPalm':[1.5,0,2.03],'swordGrip':list(r.data.bones['Sword'].head_local),'bootBounds':{}}
for key,g in groups.items():result['groups'].append({'material':g['material'],'vertices':pack(g['vertices']),'uv':pack(g['uv']),'skinIndex':pack(g['skinIndex'],'B'),'skinWeight':pack(g['skinWeight']),'indices':pack(g['indices'],'I'),'vertexCount':len(g['vertices'])//9,'triangleCount':len(g['indices'])//3})
for side in ['Right','Left']:
 o=bpy.data.objects['Ice Crown | '+side+' boot'];result['bootBounds'][side]={'min':[min(v.co[i]for v in o.data.vertices)for i in range(3)],'max':[max(v.co[i]for v in o.data.vertices)for i in range(3)]}
(A/'itrapped.json').write_text(json.dumps(result,separators=(',',':')));report={'source':str(SOURCE),'model':'Itrapped','rigName':r.name,'bones':len(bn),'sourceMeshes':len(parts),'webSkinMeshes':len(groups),'triangles':sum(x['triangleCount']for x in result['groups']),'materialNames':list(groups),'bytes':(A/'itrapped.json').stat().st_size};(Q/'reviews/itrapped-export.json').write_text(json.dumps(report,indent=2));print('ITRAPPED_SKIN_EXPORTED',json.dumps(report),flush=True)
