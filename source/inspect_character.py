import bpy,json
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath='/Users/jacobatamas/blender_models/teaser_team_combo/ice_ability_solo/Itrapped_Ice_Ability_Solo.blend');s=bpy.context.scene;r=bpy.data.objects['Ice Crown | R6 rig']
print('BONES',[(b.name,b.parent.name if b.parent else None,list(b.head_local))for b in r.data.bones],flush=True)
parts=[o for o in s.objects if o.type=='MESH'and any(m.type=='ARMATURE'and m.object==r for m in o.modifiers)]
print('PARTS',len(parts),'verts',sum(len(o.data.vertices)for o in parts),flush=True)
for o in parts:
 if 'dagger'in o.name.lower()or'cape'in o.name.lower()or'boot'in o.name.lower():
  print('DETAIL',o.name,'groups',list(o.vertex_groups.keys()),'matrix',list(o.matrix_world.translation),'bounds',[min(v.co[i]for v in o.data.vertices)for i in range(3)],[max(v.co[i]for v in o.data.vertices)for i in range(3)],'mods',[(m.type,m.show_viewport)for m in o.modifiers],flush=True)
print('TEXTURES',[(m.name,[n.image.name for n in m.node_tree.nodes if n.type=='TEX_IMAGE'and n.image])for m in bpy.data.materials if m.node_tree and any(n.type=='TEX_IMAGE'and n.image for n in m.node_tree.nodes)],flush=True)
