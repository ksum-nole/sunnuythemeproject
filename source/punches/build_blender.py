import bpy,json,base64,array
from pathlib import Path
from mathutils import Matrix,Vector
P=Path('/Users/jacobatamas/Desktop/Ice_Slam_Web_Game')
OUT=P.parent/'R6 Power Punches';OUT.mkdir(exist_ok=True)
char=json.loads((P/'dist/assets/itrapped.json').read_text());data=json.loads((P/'source/punches/poses.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;scene.render.fps=60

def unpack(encoded,kind='f'):
 a=array.array(kind);a.frombytes(base64.b64decode(encoded));return a

def material(name,color,metal=.1,rough=.4):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough;return m

arm=bpy.data.armatures.new('Original rigid R6 skeleton');rig=bpy.data.objects.new('Itrapped | Power punches',arm);scene.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT');rest={}
for row in char['bones']:
 m=Matrix([row['rest'][i::4]for i in range(4)]);rest[row['name']]=m;b=arm.edit_bones.new(row['name']);b.head=m.translation;b.tail=m@Vector((0,.45,0));b.matrix=m;b.length=.45
for row in char['bones']:
 if row['parent']:arm.edit_bones[row['name']].parent=arm.edit_bones[row['parent']]
bpy.ops.object.mode_set(mode='OBJECT')
for group in char['groups']:
 v=unpack(group['vertices']);verts=[v[i:i+3]for i in range(0,len(v),9)];indices=unpack(group['indices'],'I');mesh=bpy.data.meshes.new(group['material']['name']);mesh.from_pydata(verts,[],[indices[i:i+3]for i in range(0,len(indices),3)]);mesh.update();o=bpy.data.objects.new(group['material']['name'],mesh);scene.collection.objects.link(o)
 p=group['material'];m=material(p['name'],(.6,.6,.6),p['metalness'],p['roughness']);bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(*p['emission'],1);bs.inputs['Emission Strength'].default_value=p['emissionStrength'];colors=mesh.color_attributes.new(name='Original colors',type='FLOAT_COLOR',domain='POINT')
 for i,c in enumerate(colors.data):c.color=(*v[i*9+6:i*9+9],1)
 node=m.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='Original colors';m.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color'])
 if p.get('texture'):
  header,encoded=p['texture'].split(',',1);path=OUT/('skin_'+str(len(bpy.data.images))+('.png'if'png'in header else'.jpg'));path.write_bytes(base64.b64decode(encoded));im=bpy.data.images.load(str(path));im.pack();node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=im;m.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color'])
 uv=unpack(group['uv']);layer=mesh.uv_layers.new(name='UVMap')
 for loop in mesh.loops:layer.data[loop.index].uv=uv[loop.vertex_index*2:loop.vertex_index*2+2]
 mesh.materials.append(m);weights=unpack(group['skinWeight']);indices=unpack(group['skinIndex'],'B');groups=[o.vertex_groups.new(name=b['name'])for b in char['bones']]
 for i in range(len(verts)):
  for k in range(4):
   if weights[i*4+k]>.000001:groups[indices[i*4+k]].add([i],weights[i*4+k],'REPLACE')
 mod=o.modifiers.new('Original R6 skin','ARMATURE');mod.object=rig
 if p['name'].startswith('Icedagger'):o.hide_render=True;o.hide_set(True)

if data.get('iceFists'):
 ice=data['iceFists'];v=ice['vertices'];colors=ice['colors'];ice_material=material('Fists | crystalline ice',(.24,.7,.9),.16,.24);bs=ice_material.node_tree.nodes.get('Principled BSDF');vc=ice_material.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Original colors';ice_material.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color']);bs.inputs['Emission Color'].default_value=(.004,.035,.07,1);bs.inputs['Emission Strength'].default_value=.38
 for side,anchor in ice['anchors'].items():
  vertices=[tuple(v[i+j]+anchor[j]for j in range(3))for i in range(0,len(v),3)];me=bpy.data.meshes.new(side+' fist crystals');me.from_pydata(vertices,[],[tuple(range(i,i+3))for i in range(0,len(vertices),3)]);me.update();o=bpy.data.objects.new(side+' fist | seven ice crystals',me);scene.collection.objects.link(o);me.materials.append(ice_material);col=me.color_attributes.new(name='Original colors',type='FLOAT_COLOR',domain='POINT')
  for i,c in enumerate(col.data):c.color=(*colors[i*3:i*3+3],1)
  vg=o.vertex_groups.new(name=side+' Arm');vg.add(list(range(len(vertices))),1,'REPLACE');mod=o.modifiers.new('Follow original hand bone','ARMATURE');mod.object=rig

rig.animation_data_create();actions={}
for side,clip in data['actions'].items():
 action=bpy.data.actions.new('R6 | '+('Left torque punch'if side=='Left'else'Right power cross'));action.use_fake_user=True;rig.animation_data.action=action;previous={}
 for index,poses in enumerate(clip['poses']):
  frame=index/(len(clip['poses'])-1)*clip['duration']*60
  for row in char['bones']:
   name=row['name'];pb=rig.pose.bones[name];pb.rotation_mode='QUATERNION';matrix=Matrix([poses[name][i::4]for i in range(4)]);pb.matrix=matrix@rest[name];bpy.context.view_layer.update()
   if name in previous:
    q=pb.rotation_quaternion.copy();q.make_compatible(previous[name]);pb.rotation_quaternion=q
   previous[name]=pb.rotation_quaternion.copy();pb.keyframe_insert('location',frame=frame,group=name);pb.keyframe_insert('rotation_quaternion',frame=frame,group=name)
 action['Contact seconds']=clip['impact'];action['Duration seconds']=clip['duration'];action['Game key']='Z'if side=='Left'else'X'
 for layer in action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for fc in bag.fcurves:
     for key in fc.keyframe_points:key.interpolation='LINEAR'
 actions[side]=action
rig.animation_data.action=None
for side,start in [('Left',15),('Right',90)]:
 track=rig.animation_data.nla_tracks.new();track.name=side+' punch preview';strip=track.strips.new(side+' punch',start,actions[side]);strip.extrapolation='NOTHING';strip.blend_type='REPLACE'
 scene.timeline_markers.new(side.upper()+' | WINDUP',frame=start);scene.timeline_markers.new(side.upper()+' | CONTACT',frame=start+round(data['actions'][side]['impact']*60))
scene.frame_start=0;scene.frame_end=150
floor_mat=material('Studio | deep slate',(.018,.032,.045),.1,.65);bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='Studio floor';floor.location.z=-.015;floor.data.materials.append(floor_mat)
for loc,energy,size,color in [((5,7,11),1500,7,(.72,.9,1)),((-7,3,6),1050,5,(.23,.62,1)),((2,-6,8),1800,5,(1,.84,.66))]:
 bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=energy;light.data.size=size;light.data.color=color;light.rotation_euler=(Vector((0,.3,2.5))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(8,12,7));camera=bpy.context.object;camera.rotation_euler=(Vector((0,.3,2.5))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=8;scene.camera=camera
scene.world=bpy.data.worlds.new('Punch studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.06,.1,.14,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True;scene.render.resolution_x=1100;scene.render.resolution_y=850;scene.render.resolution_percentage=100
notes=bpy.data.texts.new('README | Two R6 power punches');notes.write('Two separate editable actions: R6 | Left torque punch (0.58s) and R6 | Right power cross (0.70s). Both are keyed at 60fps using the original rigid R6 bones and skin. No elbow or knee bones were added. Hips lead the shoulders; head counter-rotates; the off-hand guards. Timeline previews: left at frame 15, right at frame 90. Actions are available in the Action Editor; NLA tracks can be muted to edit them separately. Web controls: Z / X. Dagger is hidden for unarmed previews.\n')
scene.frame_set(107);bpy.context.view_layer.objects.active=rig;bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);rig.show_in_front=True
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'R6_Power_Punches.blend'),compress=True)
print('R6_PUNCHES_SAVED',len(actions),'actions',len(rig.data.bones),'bones',flush=True)
