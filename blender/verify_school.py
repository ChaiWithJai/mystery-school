"""Verify actual saved blend, GLB structure, imported geometry and PNG header."""
import bpy
import json
import math
import struct
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parents[1]
assets=root/'public'/'assets'
manifest=json.loads((root/'blender'/'scene-manifest.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(assets/'school.blend'))
authored_meshes=sum(o.type=='MESH' for o in bpy.context.scene.objects)
assert authored_meshes>100
assert bpy.context.scene.camera is not None
authored_foliage = {}
for obj in bpy.context.scene.objects:
    if obj.get('export_group'):
        authored_foliage.setdefault(obj['export_group'], []).append(obj.name)
assert len(authored_foliage) == 41
for components in authored_foliage.values():
    assert len(components) == 9
    assert any(n.startswith('Cedar trunk') for n in components)
    assert sum(n.startswith('Layered cedar foliage') for n in components) == 5
raw=(assets/'school.glb').read_bytes()
magic,version,length=struct.unpack_from('<4sII',raw)
assert magic==b'glTF' and version==2 and length==len(raw)
chunk_length,chunk_type=struct.unpack_from('<II',raw,12)
assert chunk_type==0x4E4F534A
gltf=json.loads(raw[20:20+chunk_length])
assert not gltf.get('cameras')
assert 'KHR_lights_punctual' not in gltf.get('extensions',{})
nodes={n.get('name'):n for n in gltf['nodes']}
foliage_nodes=[]
for island in manifest['density_control']['islands']:
    parent = nodes[island['anchor']]
    children = [gltf['nodes'][i] for i in parent['children']]
    for batch, name in enumerate(island['nodes']):
        node = nodes[name]
        assert node in children and 'mesh' in node
        assert node['extras']['foliage_batch'] == batch
        assert node['extras']['foliage_batch_count'] == island['batch_count']
        foliage_nodes.append(name)
assert len(foliage_nodes) == 41
assert 'mesh' in nodes['connections']
assert len(gltf['meshes']) == 49
assert nodes['island_library'].get('translation', [0,0,0]) == [0,0,0]
for anchor in manifest['satellites']:
    node=nodes[anchor['node']]
    actual=node.get('translation',[0,0,0])
    assert all(abs(a-b)<.00001 for a,b in zip(actual,anchor['position'])),(anchor,actual)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(assets/'school.glb'))
bpy.context.view_layer.update()
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
coords=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box]
lo=[min(v[i] for v in coords) for i in range(3)]
hi=[max(v[i] for v in coords) for i in range(3)]
bounds={'min':[lo[0],lo[2],-hi[1]],'max':[hi[0],hi[2],-lo[1]]}
assert all(math.isfinite(x) for k in bounds for x in bounds[k])
png=(assets/'school-preview.png').read_bytes()
assert png[:8]==b'\x89PNG\r\n\x1a\n'
width,height=struct.unpack_from('>II',png,16)
assert width>=1200 and height>=1000
report={'verified':True,'blender_version':bpy.app.version_string,'authored_mesh_objects':authored_meshes,
        'glb_mesh_objects':len(meshes),'glb_materials':len(gltf.get('materials',[])),
        'glb_primitives':sum(len(m['primitives']) for m in gltf['meshes']),
        'glb_triangles':sum(len(o.data.loop_triangles) for o in meshes),
        'imported_bounds_y_up':bounds,'preview_dimensions':[width,height],
        'files':{p.name:p.stat().st_size for p in [assets/'school.blend',assets/'school.glb',assets/'school-preview.png']}}
for o in meshes:o.data.calc_loop_triangles()
report['glb_triangles']=sum(len(o.data.loop_triangles) for o in meshes)
assert report['glb_triangles'] == 37678
report['foliage_nodes'] = foliage_nodes
report['connection_node'] = 'connections'
report['density_control_verified'] = True
(root/'blender'/'verification.json').write_text(json.dumps(report,indent=2)+'\n')
print('ASTRAL_VERIFIED '+json.dumps(report))
