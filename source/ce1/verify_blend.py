import bpy,json
from pathlib import Path
from mathutils import Vector
P=Path('/Users/jacobatamas/Desktop/Ice_Slam_Web_Game');char=json.loads((P/'dist/assets/itrapped.json').read_text());s=bpy.context.scene;maximum=0
for row in char['references']:
 s.frame_set(row['frame']);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
 for sample in row['samples']:
  obj=bpy.data.objects[sample['group']];ev=obj.evaluated_get(deps);me=ev.to_mesh();point=ev.matrix_world@me.vertices[sample['index']].co;maximum=max(maximum,(point-Vector(sample['point'])).length);ev.to_mesh_clear()
ice=json.loads((P/'dist/assets/ice.json').read_text());s.frame_set(ice['impactFrame']+18);bpy.context.view_layer.update();fx=[o for o in s.objects if o.name.startswith('ICE |')];low=min((o.matrix_world@v.co).z for o in fx for v in o.data.vertices)
print('BLENDER_VALIDATION',maximum,low,flush=True)
assert maximum<.0002,maximum
assert low>=-.00001,low
(P/'reviews/ce1/native-validation.json').write_text(json.dumps({'status':'PASS','maximumSkinReferenceError':maximum,'minimumIceHeight':low,'fxObjects':len(fx)},indent=2))
