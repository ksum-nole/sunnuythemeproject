"""Export the user's foundry and finalized stomp to browser-friendly static buffers.
Original .blend files are read only. Blender Z-up is converted by the web scene.
"""
import bpy,json,math,base64,array,hashlib
from pathlib import Path
from mathutils import Vector,noise
Q=Path('/Users/jacobatamas/Desktop/Ice_Slam_Web_Game');A=Q/'dist/assets'
def b64floats(values):return base64.b64encode(array.array('f',values).tobytes()).decode()
def b64uint(values):return base64.b64encode(array.array('I',values).tobytes()).decode()
def props(mat):
 p=mat.node_tree.nodes.get('Principled BSDF')if mat and mat.node_tree else None
 col=list(mat.diffuse_color[:3])if mat else[.3,.3,.3];em=[0,0,0];strength=0
 if p:
  em=list(p.inputs['Emission Color'].default_value[:3]);strength=p.inputs['Emission Strength'].default_value
 return {'name':mat.name if mat else'Default','color':col,'metalness':float(p.inputs['Metallic'].default_value)if p else 0,'roughness':float(p.inputs['Roughness'].default_value)if p else .6,'emission':em,'emissionStrength':min(2.5,float(strength))}
# Static map: bake manufactured bevels/normals, retain the original palette and signs.
bpy.ops.wm.open_mainfile(filepath='/Users/jacobatamas/blender_maps/deathmatch_foundry/CINDER_07_Deathmatch.blend');s=bpy.context.scene;deps=bpy.context.evaluated_depsgraph_get();groups={};collision=[];collider_names=[]
for o in s.objects:
 if o.hide_render or o.type not in ['MESH','CURVE','FONT']:continue
 ev=o.evaluated_get(deps);me=ev.to_mesh()
 if not me:continue
 me.calc_loop_triangles();flip=sum(me.vertices[t.vertices[0]].co.dot(me.vertices[t.vertices[1]].co.cross(me.vertices[t.vertices[2]].co))for t in me.loop_triangles)<-1e-6;W=o.matrix_world;N=W.to_3x3().inverted().transposed();slots=[slot.material for slot in o.material_slots]
 for tri in me.loop_triangles:
  mat=slots[min(tri.material_index,len(slots)-1)]if slots else None;key=mat.name if mat else'Default'
  if key not in groups:groups[key]={'material':props(mat),'verts':[],'indices':[],'lookup':{}}
  g=groups[key];base=g['material']['color'];var=.05 if g['material']['metalness']<.4 else.025
  for li in (tuple(reversed(tri.loops))if flip else tri.loops):
   co=W@me.vertices[me.loops[li].vertex_index].co;normal=(N@me.corner_normals[li].vector).normalized()*(-1 if flip else 1);factor=1+var*noise.noise(co*.55);color=[max(0,min(1,c*factor))for c in base];data=[*co,*normal,*color];vk=tuple(round(v,5)for v in data);idx=g['lookup'].get(vk)
   if idx is None:idx=len(g['verts'])//9;g['lookup'][vk]=idx;g['verts'].extend(data)
   g['indices'].append(idx)
 # Physics: un-beveled structural meshes, with decorative floor treads omitted.
 cn=' '.join(c.name for c in o.users_collection);include=any(cn.startswith(n)for n in ['02 |','03 |','04 |','05 |','06 |'])
 if any(word in o.name.lower()for word in ['tread','seam','stencil','louver','lamp','identification','colored band','fascia','grating inset','signal strip','illuminated']):include=False
 if o.type=='MESH':
  volume=math.prod(o.dimensions);include=include and volume>.012 and max(o.dimensions)>.3
 if include:
  raw=o.data if o.type=='MESH'else me;raw.calc_loop_triangles();rawflip=sum(raw.vertices[t.vertices[0]].co.dot(raw.vertices[t.vertices[1]].co.cross(raw.vertices[t.vertices[2]].co))for t in raw.loop_triangles)<-1e-6;start=len(collision)//3
  for tri in raw.loop_triangles:
   for vi in (tuple(reversed(tri.vertices))if rawflip else tri.vertices):collision.extend(W@raw.vertices[vi].co)
  collider_names.append({'name':o.name,'start':start,'count':len(collision)//3-start})
 ev.to_mesh_clear()
# Continuous ground avoids catching the controller on decorative floor-panel seams.
for p in [(-28,-24,0),(28,-24,0),(28,24,0),(-28,-24,0),(28,24,0),(-28,24,0)]:collision.extend(p)
mapdata={'name':'CINDER 07 | Deathmatch Foundry','source':'CINDER_07_Deathmatch.blend','groups':[],'collision':b64floats(collision),'colliders':collider_names,'spawns':[list(o.location)for o in sorted(s.objects,key=lambda o:o.name)if o.name.startswith('SPAWN')]}
for g in groups.values():mapdata['groups'].append({'material':g['material'],'vertices':b64floats(g['verts']),'indices':b64uint(g['indices']),'vertexCount':len(g['verts'])//9,'triangleCount':len(g['indices'])//3})
(A/'foundry.json').write_text(json.dumps(mapdata,separators=(',',':')));print('FOUNDRY_EXPORTED',len(groups),'draw groups',sum(g['triangleCount']for g in mapdata['groups']),'triangles',len(collision)//9,'collision triangles',flush=True)
# Native ice burst, without the later victim pin pillars or the added launch ridge.
bpy.ops.wm.open_mainfile(filepath='/Users/jacobatamas/Desktop/Shedletsky_R6_Ice_Axe_Stomp_Static_Camera.blend');s=bpy.context.scene;deps=bpy.context.evaluated_depsgraph_get();fx=[];objects=[]
for o in s.objects:
 if o.type!='MESH':continue
 use=o.name.startswith(('Exploding ice ridge','Ground frost blast','Rolling frost blast','CHARGE |','Explosive ice debris'))
 if o.name.startswith('Explosive ice debris'):
  digits=''.join(c for c in o.name.split('|')[-1]if c.isdigit());use=bool(digits)and int(digits)%4==0
 if not use:continue
 me=o.data;me.calc_loop_triangles();slots=[p.material for p in o.material_slots];verts=[]
 for tri in me.loop_triangles:
  mat=slots[min(tri.material_index,len(slots)-1)]if slots else None;col=props(mat)['color']
  for li in tri.loops:verts.extend([*me.vertices[me.loops[li].vertex_index].co,*me.corner_normals[li].vector,*col])
 fx.append({'name':o.name,'vertices':b64floats(verts),'samples':None});objects.append(o)
frames=list(range(1,182,2));all_samples=[[]for _ in objects]
for f in frames:
 s.frame_set(f);bpy.context.view_layer.update()
 for i,o in enumerate(objects):
  loc,q,sc=o.matrix_world.decompose();visible=0 if o.hide_render or max(abs(x)for x in sc)<.0002 else 1;all_samples[i].extend([*loc,q.x,q.y,q.z,q.w,*sc,visible])
for i,row in enumerate(fx):row['samples']=b64floats(all_samples[i])
# Keep the exact authored 60fps body motion. Release movement when recovery is complete.
poses=json.loads(Path('/Users/jacobatamas/blender_models/teaser_team_combo/source/ice_latest.json').read_text())['poses'];names=['Torso','Head','Right Arm','Left Arm','Right Leg','Left Leg','Sword'];clip={}
for n in names:
 values=[]
 from mathutils import Matrix
 for f in range(1,119):
  M=Matrix(poses[str(f)][n]);loc,q,sc=M.decompose();values.extend([*loc,q.x,q.y,q.z,q.w,*sc])
 clip[n]=b64floats(values)
icedata={'source':'Shedletsky_R6_Ice_Axe_Stomp_Static_Camera.blend','fps':60,'bodyFrames':118,'impactFrame':58,'fxSampleFrames':frames,'fxSampleRate':30,'objects':fx,'clip':clip,'excluded':'The two later pin pillars and the separate victim launch ridge are not exported.'}
(A/'ice.json').write_text(json.dumps(icedata,separators=(',',':')))
report={'mapGroups':len(mapdata['groups']),'mapTriangles':sum(g['triangleCount']for g in mapdata['groups']),'collisionTriangles':len(collision)//9,'iceObjects':len(fx),'nativeAnimationFPS':60,'bodyFrames':118,'twoPinPillars':0,'foundryBytes':(A/'foundry.json').stat().st_size,'iceBytes':(A/'ice.json').stat().st_size};(Q/'reviews/asset-export.json').write_text(json.dumps(report,indent=2));print('WEB_ASSETS_READY',json.dumps(report),flush=True)
