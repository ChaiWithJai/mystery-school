"""Deterministic, editable Astral School. Run with Blender --background --python."""
import bpy
import json
import math
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'assets'
random.seed(41)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
bpy.context.preferences.filepaths.save_version = 0
M = {}
FOLIAGE_GROUP = None
FOLIAGE_COUNTS = {}


def material(name, color, metallic=0, roughness=.8, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = roughness
    if emission:
        p.inputs['Emission Color'].default_value = (*color, 1)
        p.inputs['Emission Strength'].default_value = emission
    M[name] = mat
    return mat


material('pine', (.035, .105, .070))
material('fern', (.09, .20, .105))
material('moss', (.235, .31, .15))
material('sage', (.36, .43, .245))
material('stone', (.20, .235, .20))
material('slate', (.095, .135, .125))
material('earth', (.15, .115, .075))
material('bark', (.225, .165, .09))
material('paper', (.72, .64, .43))
material('brass', (.55, .365, .12), .62, .38)
material('glow', (1, .66, .25), .1, .4, 1.6)
material('water', (.14, .30, .27), .35, .22)
material('book-red', (.30, .125, .085))


def mesh(name, verts, faces, mat, parent=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.materials.append(M[mat])
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.parent = parent
    if FOLIAGE_GROUP is not None:
        obj['export_group'] = FOLIAGE_GROUP
        obj['foliage_batch'] = FOLIAGE_COUNTS[parent.name] - 1
    return obj


def empty(name, loc=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.location = loc
    obj.parent = parent
    return obj


def tube(name, points, radius, mat, parent=None, sides=7):
    verts, faces = [], []
    for i, pt in enumerate(points):
        p = Vector(pt)
        tangent = Vector(points[min(i+1, len(points)-1)]) - Vector(points[max(i-1, 0)])
        tangent.normalize()
        ref = Vector((0, 0, 1)) if abs(tangent.z) < .9 else Vector((1, 0, 0))
        u = tangent.cross(ref).normalized()
        v = tangent.cross(u).normalized()
        r = radius[i] if isinstance(radius, list) else radius
        for j in range(sides):
            a = j * math.tau / sides
            verts.append(tuple(p + r * (u * math.cos(a) + v * math.sin(a))))
    for i in range(len(points)-1):
        for j in range(sides):
            k = i*sides+j
            faces.append((k, i*sides+(j+1)%sides, (i+1)*sides+(j+1)%sides, k+sides))
    faces.extend([tuple(reversed(range(sides))), tuple(range(len(verts)-sides, len(verts)))])
    return mesh(name, verts, faces, mat, parent)


def cylinder(name, loc, radius, depth, mat, parent=None, top=None, n=16):
    return tube(name, [(loc[0], loc[1], loc[2]-depth/2), (loc[0], loc[1], loc[2]+depth/2)],
                [radius, radius if top is None else top], mat, parent, n)


def cube(name, loc, scale, mat, parent=None, angle=0):
    verts = []
    for x, y, z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]:
        x, y, z = x*scale[0]/2, y*scale[1]/2, z*scale[2]/2
        verts.append((loc[0]+x*math.cos(angle)-y*math.sin(angle), loc[1]+x*math.sin(angle)+y*math.cos(angle), loc[2]+z))
    return mesh(name, verts, [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)], mat, parent)


def rock(name, loc, scale, mat, parent=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1)
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = loc
    obj.scale = scale
    obj.rotation_euler = (random.random()*.4, random.random()*.3, random.random()*6)
    obj.data.materials.append(M[mat])
    return obj


def ring(name, loc, radius, mat, parent=None, thickness=.025):
    pts = [(loc[0]+radius*math.cos(a*math.tau/64), loc[1]+radius*math.sin(a*math.tau/64), loc[2]) for a in range(65)]
    return tube(name, pts, thickness, mat, parent)


def island(parent, radius, deep):
    n = 40
    profile = [(.08, radius*.97), (-.15, radius), (-.5, radius*.93), (-deep*.57, radius*.63), (-deep, radius*.18)]
    verts = []
    jitter = [random.uniform(.91, 1.04) for _ in range(n)]
    for z, r in profile:
        for j in range(n):
            a = j*math.tau/n
            verts.append((math.cos(a)*r*jitter[j], math.sin(a)*r*jitter[j], z+random.uniform(-.045,.045)))
    faces = [tuple(range(n))]
    for k in range(len(profile)-1):
        for j in range(n):
            faces.append((k*n+j, (k+1)*n+j, (k+1)*n+(j+1)%n, k*n+(j+1)%n))
    faces.append(tuple(reversed(range(len(verts)-n,len(verts)))))
    obj = mesh('Stratified floating bedrock', verts, faces, 'moss', parent)
    for name in ['stone','slate','earth','sage']:
        obj.data.materials.append(M[name])
    for i, p in enumerate(obj.data.polygons):
        p.material_index = 0 if i == 0 else (4 if i <= n and i%5 == 0 else 1 if i <= 2*n else 2 if i%3 else 3)
    for j in range(19):
        a = random.uniform(0, math.tau)
        r = radius*random.uniform(.75, .97)
        x,y = math.cos(a)*r, math.sin(a)*r
        rock('Lichen on rim', (x,y,-.05), (random.uniform(.15,.4),.23,.19), random.choice(['moss','sage','stone']),parent)
    for j in range(9):
        a = j*math.tau/9+.15
        x,y = math.cos(a)*radius*.75, math.sin(a)*radius*.75
        tube('Hanging ancient root', [(x,y,-.25),(x*.85,y*.85,-deep*.55),(x*.6+.15,y*.6,-deep*random.uniform(1.05,1.3))], [.07,.045,.007], 'bark', parent)


def pine(parent, x, y, h):
    global FOLIAGE_GROUP
    batch = FOLIAGE_COUNTS.get(parent.name, 0)
    FOLIAGE_COUNTS[parent.name] = batch + 1
    FOLIAGE_GROUP = 'foliage_' + parent.name.removeprefix('island_') + '_' + str(batch)
    cylinder('Cedar trunk',(x,y,h*.43),h*.045,h*.86,'bark',parent,n=7)
    for k in range(5):
        z = h*(.27+k*.135)
        r = h*(.27-k*.038)
        n=11
        verts=[(x,y,z+h*.40)]
        for j in range(n):
            a=j*math.tau/n+k*.6
            rr=r*random.uniform(.8,1.17)
            verts.append((x+math.cos(a)*rr,y+math.sin(a)*rr,z+random.uniform(-.07,.07)))
        verts.append((x,y,z-.03))
        faces=[(0,j+1,(j+1)%n+1) for j in range(n)]
        faces += [(n+1,(j+1)%n+1,j+1) for j in range(n)]
        obj=mesh('Layered cedar foliage',verts,faces,random.choice(['pine','fern','moss']),parent)
        obj.data.materials.append(M['sage'])
        for p in obj.data.polygons:
            if random.random()<.10:p.material_index=1
    for k in range(3):
        a=k*2.4
        tube('Cedar branch',[(x,y,h*.32),(x+math.cos(a)*h*.18,y+math.sin(a)*h*.18,h*.38)],.025,'bark',parent)
    FOLIAGE_GROUP = None


def portal(parent, x=0, y=-.45):
    for s in [-1,1]:
        cylinder('Portal stone foot',(x+s*.48,y,.15),.16,.23,'paper',parent)
    points=[(x-.48,y,.25),(x-.48,y,1.03)]
    points += [(x+.48*math.cos(math.pi-j*math.pi/24),y,1.03+.48*math.sin(math.pi-j*math.pi/24)) for j in range(25)]
    points += [(x+.48,y,.25)]
    tube('Brass threshold arch',points,.043,'brass',parent)
    tube('Warm threshold light',[(px,py-.016,pz) for px,py,pz in points],.015,'glow',parent)
    for j in range(3):
        cube('Threshold stair',(x,y-.15-j*.19,.05+j*.018),(.9-j*.07,.20,.09),'paper',parent)


def details(parent, radius):
    for j in range(7):
        y=-radius*.85+j*radius*.13
        rock('Worn path stone',(.12*math.sin(j),y,.12),(.22,.14,.06),'paper',parent)
    for j in range(12):
        a=random.uniform(0,math.tau)
        r=random.uniform(.7,radius*.85)
        x,y=math.cos(a)*r,math.sin(a)*r
        if y<0 and abs(x)<.5:continue
        for k in range(3):
            b=k*math.tau/3
            tube('Forest fern',[(x,y,.1),(x+math.cos(b)*.11,y+math.sin(b)*.11,.27),(x+math.cos(b)*.18,y+math.sin(b)*.18,.21)], [.018,.015,.004],'sage',parent,sides=4)
    for x in [-.7,.7]:
        cylinder('Lantern post',(x,-1,.42),.025,.65,'brass',parent,n=6)
        cube('Paper lantern',(x,-1,.8),(.13,.13,.19),'glow',parent)
        cylinder('Lantern cap',(x,-1,.91),.115,.06,'brass',parent,top=0,n=6)


school=empty('Astral School')
school['authored_demo']=True
anchors=[]
names=['memory','questions','experiments','futures','people','reflection']
central=empty('island_library',parent=school)
central['radius']=3.3
island(central,3.3,2.6)
details(central,3.3)

# The library nestles in the roots, below a spreading old-growth canopy.
tube('Old library tree',[(0,.5,0),(-.22,.5,1.5),(.05,.52,3),(-.12,.55,4.25)], [.52,.41,.30,.16], 'bark',central,11)
for j in range(9):
    a=j*math.tau/9
    tube('Buttress root',[(0,.5,.65),(math.cos(a)*.85,.5+math.sin(a)*.85,.16),(math.cos(a)*1.8,.5+math.sin(a)*1.8,.08)], [.19,.12,.016],'bark',central)
for j in range(10):
    a=j*2.399
    tip=(math.cos(a)*random.uniform(1.1,2.0),.5+math.sin(a)*random.uniform(1.1,1.8),random.uniform(3.7,4.9))
    tube('Oak bough',[(0,.5,2.5),(.45*tip[0],.5+(tip[1]-.5)*.45,3.5),tip],[.19,.12,.03],'bark',central)
    for k in range(4):
        p=(tip[0]+random.uniform(-.48,.48),tip[1]+random.uniform(-.48,.48),tip[2]+random.uniform(-.1,.45))
        rock('Sculpted oak crown',p,(random.uniform(.65,1),random.uniform(.65,.9),random.uniform(.4,.65)),random.choice(['pine','fern','moss','sage']),central)

cylinder('Round library foundation',(0,-.7,.19),1.12,.30,'stone',central,n=32)
cylinder('Limewash library walls',(0,-.7,.79),.92,1.0,'paper',central,n=32)
cylinder('Library patinated roof',(0,-.7,1.49),1.19,.54,'pine',central,top=.38,n=32)
ring('Roof brass seam',(0,-.7,1.23),1.19,'brass',central)
for j in range(16):
    a=j*math.tau/16
    tube('Roof ribs',[(math.cos(a)*1.17,-.7+math.sin(a)*1.17,1.23),(math.cos(a)*.38,-.7+math.sin(a)*.38,1.76)],.014,'brass',central)
for j in range(9):
    a=math.pi+j*math.pi/8
    x,y=math.cos(a)*.925,-.7+math.sin(a)*.925
    cube('Library window',(x,y,.88),(.18,.05,.40),'glow',central,angle=a-math.pi/2)
    cube('Window mullion',(x*1.002,-.7+(y+.7)*1.002,.88),(.022,.064,.43),'brass',central,angle=a-math.pi/2)
portal(central,0,-1.64)
for j in range(5):
    pine(central,-2.2+j*.9,1.6+random.uniform(-.3,.3),random.uniform(1.45,2.3))
# Small outdoor reading desks and real individual books remain editable.
for x in [-1.8,1.8]:
    cube('Reading desk',(x,-.7,.47),(.65,.40,.07),'bark',central)
    for dx in [-.25,.25]:
        cube('Desk leg',(x+dx,-.7,.27),(.055,.29,.4),'brass',central)
    for j in range(3):
        cube('Book cover',(x-.19+j*.17,-.7,.54),(.14,.24,.04),['book-red','pine','brass'][j],central,angle=.1*j)
        cube('Book pages',(x-.19+j*.17,-.7,.565),(.125,.225,.016),'paper',central,angle=.1*j)

for i,name in enumerate(names):
    a=i*math.pi/3
    gx,gz=9.2*math.cos(a),9.2*math.sin(a)
    # Blender (x,y,z) becomes glTF (x,z,-y).
    p=empty('island_'+name,(gx,-gz,0),school)
    p['world_id']=name
    p['radius']=2.0
    anchors.append({'id':name,'position':[round(gx,6),0,round(gz,6)],'radius':2.0,'node':p.name})
    island(p,2,1.9)
    details(p,2)
    portal(p)
    for j in range(6):
        a2=.1+j*math.pi/5
        pine(p,math.cos(a2)*1.25,math.sin(a2)*1.1+.1,random.uniform(1.45,2.6))
    if name=='reflection':
        cylinder('Still reflecting pool',(.15,.2,.12),.64,.05,'water',p,n=48)
        ring('Pool stone lip',(.15,.2,.14),.68,'paper',p,thickness=.055)
    elif name=='questions':
        for j in range(3):
            cylinder('Question standing stone',(-.6+j*.6,.38,.48),.15,.8+j*.16,'paper',p,n=6)
    elif name=='memory':
        for j in range(4):
            cube('Archive shelf',(-.45,.40,.25+j*.20),(.80,.26,.04),'bark',p)
            for k in range(6):
                cube('Archive volume',(-.77+k*.12,.4,.34+j*.20),(.08,.20,.14),['paper','pine','book-red'][k%3],p)
    elif name=='experiments':
        cylinder('Experiment table',(0,.35,.48),.50,.08,'paper',p,n=12)
        cylinder('Table pedestal',(0,.35,.27),.12,.45,'brass',p)
        for j in range(3):
            rock('Botanical specimen',(-.25+j*.25,.35,.67),(.09,.09,.16),'sage',p)
    elif name=='futures':
        cylinder('Observatory plinth',(0,.3,.2),.48,.23,'paper',p)
        for j in range(2):
            pts=[(.43*math.cos(k*math.tau/48),.3+.43*math.sin(k*math.tau/48)*math.sin(j*.8),.8+.43*math.sin(k*math.tau/48)*math.cos(j*.8)) for k in range(49)]
            tube('Antique armillary',pts,.025,'brass',p)
        cylinder('Armillary stem',(0,.3,.43),.045,.40,'brass',p)
    else:
        for j in range(5):
            a2=j*math.tau/5
            cylinder('Circle of seats',(.58*math.cos(a2),.3+.58*math.sin(a2),.24),.17,.30,'bark',p)
    # Thin, warm cartographic connections leave space for interactive overlays.
    start=Vector((gx,-gz,0)).normalized()*3.4
    end=Vector((gx,-gz,0)).normalized()*7.15
    pts=[]
    for j in range(25):
        t=j/24
        q=start.lerp(end,t)
        q.z=-.10-.36*math.sin(t*math.pi)
        pts.append(tuple(q))
    tube('Atlas connection '+name,pts,.018,'brass',school)

bpy.context.view_layer.update()
geometry=[o for o in scene.objects if o.type=='MESH']
coords=[o.matrix_world@Vector(v) for o in geometry for v in o.bound_box]
bmin=[min(v[i] for v in coords) for i in range(3)]
bmax=[max(v[i] for v in coords) for i in range(3)]
metadata={'units':'meters','up':'Y','central':{'node':'island_library','position':[0,0,0],'radius':3.3},'satellites':anchors,
          'bounds':{'min':[bmin[0],bmin[2],-bmax[1]],'max':[bmax[0],bmax[2],-bmin[1]]},
          'blender_version':bpy.app.version_string,'seed':41,'lights_exported':False}
metadata['density_control'] = {
    'connection_node': 'connections',
    'preserved_landmark': 'central oak and library',
    'islands': [{
        'anchor': anchor,
        'nodes': ['foliage_' + anchor.removeprefix('island_') + '_' + str(i) for i in range(count)],
        'batch_count': count,
    } for anchor, count in FOLIAGE_COUNTS.items()],
    'visibility_rule': 'batch_index < ceil(clamp(tree_density, 0, 1) * batch_count)',
}
OUT.mkdir(parents=True,exist_ok=True)
(ROOT/'blender'/'scene-manifest.json').write_text(json.dumps(metadata,indent=2)+'\n')

# Save the authored scene with its own preview rig; export geometry alone.
world=bpy.data.worlds.new('Warm paper atmosphere')
world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.62,.67,.58,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.6
camera_bg=world.node_tree.nodes.new('ShaderNodeBackground')
camera_bg.inputs[0].default_value=(.82,.78,.68,1)
ray=world.node_tree.nodes.new('ShaderNodeLightPath')
mix=world.node_tree.nodes.new('ShaderNodeMixShader')
world.node_tree.links.new(ray.outputs['Is Camera Ray'],mix.inputs[0])
world.node_tree.links.new(world.node_tree.nodes['Background'].outputs[0],mix.inputs[1])
world.node_tree.links.new(camera_bg.outputs[0],mix.inputs[2])
world.node_tree.links.new(mix.outputs[0],world.node_tree.nodes['World Output'].inputs['Surface'])
scene.world=world
def area(name,loc,power,color,size):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=power
    data.color=color
    data.shape='DISK'
    data.size=size
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=loc
    obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
area('Soft morning sun',(-8,-12,18),2400,(1,.84,.61),12)
area('Forest sky fill',(10,4,12),1800,(.68,.80,.72),10)
camera_data=bpy.data.cameras.new('Atlas camera')
camera=bpy.data.objects.new('Atlas camera',camera_data)
scene.collection.objects.link(camera)
camera.location=(0,-27,32)
camera.rotation_euler=(Vector((0,0,.3))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO'
camera_data.ortho_scale=27
scene.camera=camera
scene.render.resolution_x=1600
scene.render.resolution_y=1300
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
scene.render.filepath=str(OUT/'school-preview.png')
scene.view_settings.view_transform='AgX'
try:
    scene.render.engine='CYCLES' if '--cycles' in __import__('sys').argv else 'BLENDER_EEVEE_NEXT'
except TypeError:
    scene.render.engine='CYCLES'
scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.image_settings.color_mode='RGBA'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'school.blend'))

# Keep complete cedars as controllable batches under their original island.
# The saved blend retains tagged individual components for authoring.
groups={}
for obj in geometry:
    parent=obj.parent
    key=obj.get('export_group') or ('connections' if parent == school else parent.name+'_geometry')
    groups.setdefault(key,[]).append(obj)
bpy.ops.object.select_all(action='DESELECT')
copies=[]
for key,objects in groups.items():
    batch=[]
    for original in objects:
        obj=original.copy()
        obj.data=original.data.copy()
        scene.collection.objects.link(obj)
        batch.append(obj)
        obj.select_set(True)
    bpy.context.view_layer.objects.active=batch[0]
    bpy.ops.object.join()
    obj=bpy.context.view_layer.objects.active
    obj.name=key
    if key.startswith('foliage_'):
        obj['foliage_batch_count']=FOLIAGE_COUNTS[obj.parent.name]
        obj['world_id']=obj.parent.name.removeprefix('island_')
    copies.append(obj)
    obj.select_set(False)
for obj in copies:obj.select_set(True)
for obj in [school,central]+[o for o in scene.objects if o.name in ['island_'+n for n in names]]:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'school.glb'),export_format='GLB',use_selection=True,export_yup=True,export_lights=False,export_cameras=False,export_extras=True)
for obj in copies:bpy.data.objects.remove(obj,do_unlink=True)
bpy.ops.render.render(write_still=True)
print('ASTRAL_ASSET_COMPLETE '+json.dumps(metadata))
