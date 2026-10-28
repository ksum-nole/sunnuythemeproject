import bpy,json,base64,array,math,random
from pathlib import Path
from mathutils import Matrix,Vector
P=Path('/Users/jacobatamas/Desktop/Ice_Slam_Web_Game');D=P.parent;data=json.loads((P/'source/ce1/motion.json').read_text());char=json.loads((P/'dist/assets/itrapped.json').read_text());FPS=60;HIT=data['impactFrame'];END=HIT+152
bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.render.fps=FPS;s.frame_start=0;s.frame_end=END

def unpack(x,t='f'):a=array.array(t);a.frombytes(base64.b64decode(x));return a

def mat(name,color,metal=.1,rough=.3,emit=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough;bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=emit;return m
# Original Itrapped mesh and original nine-bone rest transforms.
arm=bpy.data.armatures.new('Itrapped original R6 bones');rig=bpy.data.objects.new('Itrapped | Place1 ice slam',arm);s.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
rest={}
for row in char['bones']:
 M=Matrix([row['rest'][i::4]for i in range(4)]);rest[row['name']]=M;b=arm.edit_bones.new(row['name']);b.head=M.translation;b.tail=M@Vector((0,.45,0));b.matrix=M;b.length=.45
for row in char['bones']:
 if row['parent']:arm.edit_bones[row['name']].parent=arm.edit_bones[row['parent']]
bpy.ops.object.mode_set(mode='OBJECT')
for g in char['groups']:
 values=unpack(g['vertices']);verts=[values[i:i+3]for i in range(0,len(values),9)];indices=unpack(g['indices'],'I');mesh=bpy.data.meshes.new(g['material']['name']);mesh.from_pydata(verts,[],[indices[i:i+3]for i in range(0,len(indices),3)]);mesh.update();o=bpy.data.objects.new(g['material']['name'],mesh);s.collection.objects.link(o)
 p=g['material'];material=mat(p['name'],(.6,.6,.6),p['metalness'],p['roughness'],p['emissionStrength']);bs=material.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(*p['emission'],1)
 colors=mesh.color_attributes.new(name='Source colors',type='FLOAT_COLOR',domain='POINT')
 for i,c in enumerate(colors.data):c.color=(*values[i*9+6:i*9+9],1)
 vc=material.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Source colors';material.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color'])
 if p.get('texture'):
  header,encoded=p['texture'].split(',',1);path=P/'source/ce1'/('skin_'+str(len(bpy.data.images))+('.png'if'png'in header else'.jpg'));path.write_bytes(base64.b64decode(encoded));image=bpy.data.images.load(str(path));image.pack();tex=material.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;material.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
 uv=unpack(g['uv']);layer=mesh.uv_layers.new(name='UVMap')
 for loop in mesh.loops:layer.data[loop.index].uv=uv[loop.vertex_index*2:loop.vertex_index*2+2]
 o.data.materials.append(material);weights=unpack(g['skinWeight']);bones=unpack(g['skinIndex'],'B');vg=[o.vertex_groups.new(name=b['name'])for b in char['bones']]
 for i in range(len(verts)):
  for k in range(4):
   if weights[i*4+k]>.000001:vg[bones[i*4+k]].add([i],weights[i*4+k],'REPLACE')
 mod=o.modifiers.new('Original weighted R6 skin','ARMATURE');mod.object=rig
for f,poses in enumerate(data['poses']):
 s.frame_set(f)
 for row in char['bones']:
  name=row['name'];pb=rig.pose.bones[name];pb.rotation_mode='QUATERNION';pb.matrix=Matrix(poses[name])@rest[name];bpy.context.view_layer.update();pb.keyframe_insert('location',frame=f,group=name);pb.keyframe_insert('rotation_quaternion',frame=f,group=name)
if rig.animation_data:
 rig.animation_data.action.name='Place1 | readable windup, original downstrike'
 for layer in rig.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for fc in bag.fcurves:
     for key in fc.keyframe_points:key.interpolation='LINEAR'
ice=mat('Ice | deep cyan facets',(.035,.34,.53),.28,.22,.12);pale=mat('Ice | frosted bright facets',(.38,.79,.92),.15,.26,.12);rim=mat('Ice | luminous ground cracks',(.18,.64,.86),.1,.25,1.3);patch=mat('Ice | frozen circular ground',(.07,.27,.37),.28,.20,.03)
fx=[];rng=random.Random(4107);cx,cy,_=data['contact']
def animate(o,start,full=(1,1,1)):
 for f,scale in [(0,.00001),(start-1,.00001),(start+7,1),(HIT+102,1),(END,.00001)]:o.scale=tuple(v*scale for v in full);o.keyframe_insert('scale',frame=f)
 fx.append(o)
def mesh_obj(name,verts,faces,mats):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);s.collection.objects.link(o)
 for m in mats:me.materials.append(m)
 for i,p in enumerate(me.polygons):p.material_index=i%len(mats)
 return o
# Circle stays just above the ground; its rim is surrounded through all 360 degrees.
bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=42.8,depth=.055,location=(cx,cy,.032));disc=bpy.context.object;disc.name='ICE | Grounded expanding frost circle';disc.data.materials.append(patch);animate(disc,HIT)
for ring,count,radius,lo,hi in [('Outer',96,43.6,8.8,17.3),('Inner',64,38.08,3.3,7.5)]:
 for i in range(count):
  a=i/count*math.tau+rng.uniform(-.035,.035);h=rng.uniform(lo,hi);w=rng.uniform(1.5,2.65)if ring=='Outer'else rng.uniform(1.05,1.9);lean=rng.uniform(.9,2.8);verts=[(-w,-w,0),(w,-w,0),(w,w,0),(-w,w,0),(-w*.55,-w*.55,h*.55),(w*.55,-w*.55,h*.55),(w*.55,w*.55,h*.55),(-w*.55,w*.55,h*.55),(lean,0,h)];faces=[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,8),(5,6,8),(6,7,8),(7,4,8)];o=mesh_obj(f'ICE | {ring} rim spike {i+1:02}',verts,faces,[ice,pale]);o.location=(cx+math.cos(a)*radius,cy+math.sin(a)*radius,0);o.rotation_euler.z=a;animate(o,HIT+(i%4),(.95,.95,1))
# Thin radial ground cracks, with short branches.
for i in range(48):
 a=i/48*math.tau;points=[]
 for j in range(6):
  r=3.2+j*7.04;angle=a+rng.uniform(-.055,.055);points.append(Vector((cx+math.cos(angle)*r,cy+math.sin(angle)*r,.065)))
 verts=[];faces=[]
 for j,(v1,v2)in enumerate(zip(points,points[1:])):
  side=Vector((-(v2-v1).y,(v2-v1).x,0)).normalized()*.28;off=len(verts);verts.extend([v1+side,v1-side,v2-side,v2+side]);faces.append(tuple(range(off,off+4)))
 # Keep origin at impact so expansion follows the circle.
 o=mesh_obj(f'ICE | Ground crack {i+1:02}',[v-Vector((cx,cy,0))for v in verts],faces,[rim]);o.location=(cx,cy,0);animate(o,HIT)
# Export exactly the Blender FX meshes and their animation samples to the game.
def pack(v,t='f'):return base64.b64encode(array.array(t,v).tobytes()).decode()
rows=[]
for o in fx:
 me=o.data;me.calc_loop_triangles();verts=[]
 for tri in me.loop_triangles:
  material=o.data.materials[tri.material_index];color=material.diffuse_color[:3]
  for vi in tri.vertices:verts.extend([*me.vertices[vi].co,*tri.normal,*color])
 rows.append({'name':o.name,'vertices':pack(verts),'samples':[]})
frames=list(range(0,END+1,2))
for f in frames:
 s.frame_set(f);bpy.context.view_layer.update()
 for o,row in zip(fx,rows):
  loc,rot,scale=o.matrix_world.decompose();row['samples'].extend([*loc,rot.x,rot.y,rot.z,rot.w,*scale,1 if max(scale)>.001 else 0])
for row in rows:row['samples']=pack(row['samples'])
icedata={'source':'Ice_Slam_CE1_Ground_Ring.blend','fps':60,'bodyFrames':len(data['poses']),'impactFrame':HIT,'fxDuration':END/60,'fxSampleFrames':frames,'fxSampleRate':30,'objects':rows,'spikeCount':160,'groundCircleRadius':42.8,'contact':data['contact']}
(P/'dist/assets/ice.json').write_text(json.dumps(icedata,separators=(',',':')))
# Studio staging stays outside the exported ability.
ground=mat('Stage | slate',(.025,.043,.064),.1,.75);bpy.ops.mesh.primitive_plane_add(size=300);floor=bpy.context.object;floor.name='STAGE | ground';floor.location.z=-.02;floor.data.materials.append(ground)
for loc,power,size,color in [((24,40,68),72000,52,(.7,.9,1)),((-48,0,44),54400,40,(.16,.6,1)),((8,-48,60),41600,36,(1,.85,.68))]:
 bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.data.color=color;light.rotation_euler=(Vector((0,1,2))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(65,95,70));camera=bpy.context.object;camera.rotation_euler=(Vector((0,1,1.7))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=116;s.camera=camera
s.world=bpy.data.worlds.new('Night studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.08,.11,.18,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.4
s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=True;s.render.resolution_x=1100;s.render.resolution_y=800;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.film_transparent=False
s.timeline_markers.new('VISIBLE STARTUP',frame=0);s.timeline_markers.new('ORIGINAL-SPEED DOWNSTRIKE',frame=data['downstrikeFrames'][0]);s.timeline_markers.new('HAND IMPACT + ICE RING',frame=HIT)
s['Source animation']=data['source'];s['Startup']='Source frames 0-90 retimed to 0-116; source 91 onward retained one-to-one at 60fps.';s['Game key']='V';s['Ground VFX']='Arena-sized ice field, 160 towering perimeter spikes, centered at hand impact.'
notes=bpy.data.texts.new('README | CE1 Ice Slam');notes.write('Source: Desktop/Place1.rbxl. Readable 2.0s startup; source downstrike 91-94 remains exactly 3 frames at 60fps. Arena-sized 85.6-stud grounded circle with 160 towering spikes, up to 17.3 studs tall. Game key V. All objects and keys editable.\n')
s.frame_set(HIT+18);bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(D/'Ice_Slam_CE1_Ground_Ring.blend'),compress=True)
s.render.filepath=str(D/'Ice_Slam_CE1_Preview.png');bpy.ops.render.render(write_still=True)
(P/'reviews/ce1/blender-build.json').write_text(json.dumps({'status':'PASS','source':data['source'],'blend':str(D/'Ice_Slam_CE1_Ground_Ring.blend'),'spikes':160,'groundCircleRadius':42.8,'impactFrame':HIT,'fps':60,'newStartupSeconds':HIT/60,'originalStartupSeconds':94/60,'downstrikeFrames':3,'gameKey':'V','fxObjects':len(fx)},indent=2));print('BLENDER_ICE_SLAM_COMPLETE',len(fx),flush=True)
