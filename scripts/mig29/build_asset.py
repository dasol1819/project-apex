"""Refine the pinned GPL MiG-29 9.12 source; export editable Blender + web geometry.
blender -b --factory-startup --threads 4 --python scripts/mig29/build_asset.py -- --bake
SPDX-License-Identifier: GPL-2.0-only
"""
import array,json,gzip,math,shutil,sys
from pathlib import Path
import bpy,bmesh
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/su35'))
from ac_reader import read_ac
SOURCE=ROOT/'assets/mig29-source';OUT=ROOT/'web/assets/mig29';OUT.mkdir(parents=True,exist_ok=True)
for name in ['albedo.png','COPYING.txt']:shutil.copyfile(SOURCE/name,OUT/name)
objects=read_ac(SOURCE/'original.ac')+read_ac(SOURCE/'cockpit.ac')
vertices=[v for o in objects for v in o['vertices']]
lo=[min(v[i] for v in vertices) for i in range(3)];hi=[max(v[i] for v in vertices) for i in range(3)]
X_SCALE=17.32/(hi[0]-lo[0]);SPAN_SCALE=11.36/(hi[2]-lo[2]);Y_SCALE=4.73/(hi[1]-lo[1])
def convert(v):return (-v[2]*SPAN_SCALE,-(v[0]-8.75)*X_SCALE,v[1]*Y_SCALE)
def material(name,color,roughness=.65,metal=.1):
 m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=roughness;b.inputs['Metallic'].default_value=metal;return m
def part_for(name):
 side=1 if name.endswith('R') or name.endswith('.R') or name.startswith('LouversR') else 0
 if name.startswith('Louvers'):return 27+side,'louver-'+name
 for prefix,part,motion in [('Aileron',14,'aileron'),('Flaps',16,'flap'),('Slats',18,'slat'),('Stabilizer',3,'tail'),('Rudder',20,'rudder'),('Engine',7,'fixed'),('Combustion',7,'fixed'),('Flameholder',7,'fixed'),('IntakeScreen',27,'screen'),('Louver',27,'fixed')]:
  if name.startswith(prefix):return part+side,motion+('-right' if side else '-left') if motion!='fixed' else 'fixed'
 if name=='Probe':return 10,'fixed'
 if name.startswith('Louvers'):return 27+side,'louver-'+name
 if name.startswith('Wing'):return 1+side,'fixed'
 if name in ['Canopy','CanopyFrame']:return 11,'canopy'
 if name.startswith('AirBrake'):return 29,'airbrake-upper' if name.endswith('U') else 'airbrake-lower'
 if 'nosegear' in name or name in ['nosewheels','WheelGuard']:return 24,'nose-gear'
 if name.startswith(('gear1.','gear2.','wheel.','fwdgeardoor.','reargeardoor.')):return 25+side,'main-right' if side else 'main-left'
 return 11 if name in ['Windscreen','IRglass','CockpitTub','Throttle','ThrottleRails'] else 0,'fixed'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
mats={'skin':material('skin',(.55,.61,.58)),'glass':material('glass',(.12,.20,.21),.07),'metal':material('metal',(.32,.36,.34),.4,.7),'rubber':material('rubber',(.018,.022,.02),.94),'dark':material('dark',(.022,.033,.03),.85)}
records=[]
for source in objects:
 name=source['name'];faces=[f for f in source['faces'] if len(f['refs'])>=3]
 # The upstream FOD objects are visibility-only ground plugs, not hinged doors.
 # Rebuild fitted doors in the web model rather than rotating those wedge plugs.
 if name.startswith(('Warn','Annun','IntakeScreen')) or name in ['EngineL','EngineR','CombustionChamberL','CombustionChamberR','FlameholderL','FlameholderR']:continue
 kind='skin' if source['texture']=='Mig-29.rgb' else 'glass' if name in ['Canopy','Windscreen','IRglass'] else 'rubber' if name.startswith(('wheel.','nosewheels')) else 'dark' if name.startswith(('Cockpit','LouverDuct','GearWell','nosegeaerwell')) else 'metal'
 mesh=bpy.data.meshes.new(name);mesh.from_pydata([convert(v) for v in source['vertices']],[],[tuple(int(r[0]) for r in f['refs']) for f in faces]);mesh.update();uv=mesh.uv_layers.new(name='UVMap')
 for i,f in enumerate(faces):
  for j,l in enumerate(mesh.polygons[i].loop_indices):uv.data[l].uv=f['refs'][j][1:3]
 obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(mats[kind])
 # Pinned-source inner intake walls point into the passage. Their original
 # atlas is exterior paint; keep their topology but use a separate duct finish.
 if name=='fuselage':
  obj.data.materials.append(mats['dark'])
  for i in [*range(743,755),*range(819,823)]:mesh.polygons[i].material_index=1
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00010);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));crease=bm.edges.layers.float.new('crease_edge');tip=bm.verts.layers.float.new('crease_vert')
 for e in bm.edges:e[crease]=1 if e.is_boundary or e.is_manifold and e.calc_face_angle(0)>.85 else 0
 for v in bm.verts:
  if name=='Probe' and abs(-v.co.y-(lo[0]-8.75)*X_SCALE)<.01 or name.startswith('Stabilizer') and abs(-v.co.y-(hi[0]-8.75)*X_SCALE)<.01: v[tip]=1
 bm.to_mesh(mesh);bm.free()
 for f in mesh.polygons:f.use_smooth=True
 sub=obj.modifiers.new('Crease-preserving surface refinement','SUBSURF');sub.levels=3 if name in ['fuselage','Canopy','Windscreen','IRglass'] else 2 if kind in ['skin','glass'] else 1;sub.render_levels=sub.levels
 part,motion=part_for(name);obj['part']=part;obj['motion']=motion;obj['material_key']=kind;records.append(obj)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'mig29-adapted.blend'),compress=True)

blob = bytearray()
meshes = []
depsgraph = bpy.context.evaluated_depsgraph_get()


def append(values):
    offset = len(blob)
    a = array.array('f', values)
    if sys.byteorder != 'little':
        a.byteswap()
    blob.extend(a.tobytes())
    return {'offset': offset, 'count': len(values)}


for obj in records:
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh(preserve_all_data_layers=True, depsgraph=depsgraph)
    mesh.calc_loop_triangles()
    groups = {}
    for tri in mesh.loop_triangles:
        lining = obj.name == 'fuselage' and tri.material_index == 1
        side = sum(mesh.vertices[mesh.loops[l].vertex_index].co.x for l in tri.loops) > 0
        key = ('InletLiningR' if side else 'InletLiningL', 28 if side else 27, 'duct') if lining else (obj.name, int(obj['part']), obj['material_key'])
        positions, normals, uvs = groups.setdefault(key, ([], [], []))
        for loop_id in tri.loops:
            loop = mesh.loops[loop_id]
            v = mesh.vertices[loop.vertex_index].co
            n = mesh.corner_normals[loop_id].vector
            positions.extend((v.x, v.z, -v.y))
            normals.extend((n.x, n.z, -n.y))
            uvs.extend(mesh.uv_layers.active.data[loop_id].uv)
    for (name, part, kind), (positions, normals, uvs) in groups.items():
        meshes.append({'name': name, 'part': part, 'motion': obj['motion'], 'material': kind, 'position': append(positions), 'normal': append(normals), 'uv': append(uvs)})
    evaluated.to_mesh_clear()
(OUT / 'airframe.bin').write_bytes(blob)
(OUT / 'airframe.bin.gz').write_bytes(gzip.compress(bytes(blob),compresslevel=9,mtime=0))
metadata = {'version': 3, 'source': 'FGMEMBERS MiG-29 9.12 (GPL-2.0), refined game adaptation', 'authors': ['Detlef Faber', 'Gary R. Neely'], 'license': 'GPL-2.0-only', 'meshes': meshes, 'scales': [X_SCALE, Y_SCALE, SPAN_SCALE], 'sourceRevision': '646e9f9d6b958773e69cbde74602642c91fcfcaf'}
(OUT / 'airframe.json').write_text(json.dumps(metadata, separators=(',', ':')))
print('EXPORTED', len(blob), 'bytes', len(meshes), 'meshes', flush=True)

if '--bake' in sys.argv:
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = False
    scene.render.bake.margin = 24
    image = bpy.data.images.new('MiG29 Ambient Occlusion', width=2048, height=2048, alpha=False)
    image.generated_color = (1, 1, 1, 1)
    image.colorspace_settings.name = 'Non-Color'
    for m in mats.values():
        node = m.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = image
        m.node_tree.nodes.active = node
    bpy.ops.object.select_all(action='DESELECT')
    targets = [o for o in records if o['material_key'] == 'skin']
    for obj in targets:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = targets[0]
    # Bake the shared atlas once. Separate objects sharing the image cause
    # repeated full-scene bakes and waste both render time and memory.
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    bpy.ops.object.bake(type='AO', use_clear=True)
    import numpy as np
    pixels = np.empty(len(image.pixels), dtype=np.float32)
    image.pixels.foreach_get(pixels)
    assert np.max(pixels[0::4]) > .5, 'AO bake contains no illuminated surface'
    image.filepath_raw = str(OUT / 'ao.png')
    image.file_format = 'PNG'
    image.save()
    print('AO BAKED', image.filepath_raw, flush=True)
