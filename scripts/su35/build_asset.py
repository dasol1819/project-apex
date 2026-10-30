"""Blender conversion/adaptation of the pinned GPL Flanker exterior.

Run: blender -b --factory-startup --python scripts/su35/build_asset.py -- [--bake]
SPDX-License-Identifier: GPL-2.0-only
"""
import array
import json
import gzip
import math
import shutil
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from ac_reader import read_ac

SOURCE = ROOT / 'assets/su35-source'
OUT = ROOT / 'web/assets/su35'
OUT.mkdir(parents=True, exist_ok=True)
for source, target in [('albedo.png', 'albedo.png'), ('seat.png', 'seat.png'), ('COPYING', 'COPYING.txt')]:
    shutil.copyfile(SOURCE / source, OUT / target)
X_SCALE = 21.9 / (22.082701 - .005918)
SPAN_SCALE = 15.3 / (7.625 + 7.62274)
Y_SCALE = 5.9 / (3.78281 + 2.52244)


def convert(v):
    # Three: +X right, +Y up, +Z aft. Blender: +Z up, -Y aft.
    z = (v[0] - .005918) * X_SCALE - 10.6
    return (-v[2] * SPAN_SCALE, -z, (v[1] + 2.52244) * Y_SCALE - 2.1)


def material(name, texture=None, color=(.4, .42, .4, 1), roughness=.63, metal=.12):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = color
    bs.inputs['Roughness'].default_value = roughness
    bs.inputs['Metallic'].default_value = metal
    if texture:
        t = m.node_tree.nodes.new('ShaderNodeTexImage')
        t.image = bpy.data.images.load(str(SOURCE / texture))
        m.node_tree.links.new(t.outputs['Color'], bs.inputs['Base Color'])
    return m


def part_for(name):
    if name.startswith('UC_Main_Left'):
        return 25, 'main-left'
    if name.startswith('UC_Main_Right'):
        return 26, 'main-right'
    if name.startswith('UC_Nose'):
        return 24, 'nose-gear'
    if name == 'ELV_Elevon_Left':
        return 3, 'tail-left'
    if name == 'ELV_Elevon_Right':
        return 4, 'tail-right'
    if name == 'TF_Left_Rudder':
        return 20, 'rudder-left'
    if name == 'TF_Right_Rudder':
        return 21, 'rudder-right'
    if name == 'WNG_Left_Flaperon':
        return 14, 'flaperon-left'
    if name == 'WNG_Right_Flaperon':
        return 15, 'flaperon-right'
    if name in ['Canopy', 'GLS_Canopy_Rear']:
        return 11, 'canopy'
    return (11, 'fixed') if name in ['object.001', 'object'] else (0, 'fixed')


bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
mats = {
    'skin': material('skin', 'albedo.png'),
    'glass': material('glass', color=(.09, .14, .15, 1), roughness=.07, metal=.08),
    'metal': material('metal', color=(.38, .4, .38, 1), roughness=.4, metal=.72),
    'rubber': material('rubber', color=(.018, .022, .023, 1), roughness=.94, metal=0),
    'seat': material('seat', 'seat.png', roughness=.92, metal=0),
    'wheel': material('wheel', color=(.16, .23, .16, 1), roughness=.65, metal=.18),
}
mats['glass'].node_tree.nodes.get('Principled BSDF').inputs['Transmission Weight'].default_value = .55
records = []
for source in read_ac(SOURCE / 'original.ac'):
    name = source['name']
    if name in ['GLS_Canopy_Rear.001', 'EngineBlocks', 'SpeedbrakePushrod', 'HULL_Hull_Upper']:
        continue
    verts = [list(v) for v in source['vertices']]
    # Offset the original centreline optical turret for the Su-35S layout.
    if name == 'HULL_Hull_Upper.001':
        for v in verts:
            if 3.26 < v[0] < 3.68 and .94 < v[1] < 1.17 and abs(v[2]) < .13:
                v[2] -= .40
    kept = []
    for face in source['faces']:
        if len(face['refs']) < 3:
            continue
        vs = [verts[int(r[0])] for r in face['refs']]
        center = [sum(v[a] for v in vs) / len(vs) for a in range(3)]
        if name == 'HULL_Hull_Upper.001':
            # The old renderer used dark intake caps. Keep the real opening
            # and let the reconstructed duct terminate at its compressor.
            if 10.8 < center[0] < 11.6 and center[1] < .4 and .5 < abs(center[2]) < 2.0:
                a = Vector(vs[1]) - Vector(vs[0])
                b = Vector(vs[2]) - Vector(vs[0])
                normal = a.cross(b)
                if normal.length and abs(normal.normalized().x) > .90:
                    continue
            # Replace the old fixed exits with longer, separate TVC nozzles.
            if center[0] > 18.31 and .65 < abs(center[2]) < 1.94 and center[1] < .65:
                continue
            # Replace the thin tip launch rails with Su-35S equipment fairings.
            if abs(center[2]) > 7.48 and 13.7 < center[0] < 17.2:
                continue
        if name == 'object.001' and center[0] > 4.67:
            continue
        kept.append(face)
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([convert(v) for v in verts], [], [tuple(int(r[0]) for r in f['refs']) for f in kept])
    mesh.update()
    uv = mesh.uv_layers.new(name='UVMap')
    for i, f in enumerate(kept):
        for j, loop in enumerate(mesh.polygons[i].loop_indices):
            u, v = f['refs'][j][1:3]
            # AC3D stores this atlas in the negative V tile. Rebase the tile
            # without changing the artwork so browser sampling and baking agree.
            uv.data[loop].uv = (u, v + 1 if v < 0 else v)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    kind = 'skin' if source['texture'] == 'Su-27_Flanker_P01.png' else 'glass' if source['texture'] == 'Glass_Cockpit.png' else 'seat' if source['texture'] == 'Eject_Seat.png' else 'rubber' if 'Tyre' in name else 'wheel' if 'Hub' in name else 'metal'
    obj.data.materials.append(mats[kind])
    # Weld positional seams while retaining per-corner UVs and deliberate creases.
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00012)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    crease = bm.edges.layers.float.new('crease_edge')
    for edge in bm.edges:
        edge[crease] = 1.0 if edge.is_boundary or edge.is_manifold and edge.calc_face_angle(0) > .78 else 0.0
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    # Surface refinement is geometric; no change to the original texture image.
    sub = obj.modifiers.new('Surface refinement', 'SUBSURF')
    sub.subdivision_type = 'CATMULL_CLARK'
    sub.levels = 2 if kind in ['skin', 'glass'] else 1
    sub.render_levels = sub.levels
    part, motion = part_for(name)
    obj['part'] = part
    obj['motion'] = motion
    obj['material_key'] = kind
    records.append(obj)

bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'su35-adapted.blend'), compress=True)
for image in bpy.data.images:
    if image.source == 'FILE':
        image.filepath = '//' + Path(image.filepath).name
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'su35-adapted.blend'), compress=True)

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
    positions, normals, uvs = [], [], []
    for tri in mesh.loop_triangles:
        for loop_id in tri.loops:
            loop = mesh.loops[loop_id]
            v = mesh.vertices[loop.vertex_index].co
            n = mesh.corner_normals[loop_id].vector
            positions.extend((v.x, v.z, -v.y))
            normals.extend((n.x, n.z, -n.y))
            uvs.extend(mesh.uv_layers.active.data[loop_id].uv)
    meshes.append({'name': obj.name, 'part': int(obj['part']), 'motion': obj['motion'], 'material': obj['material_key'], 'position': append(positions), 'normal': append(normals), 'uv': append(uvs)})
    evaluated.to_mesh_clear()
(OUT / 'airframe.bin').write_bytes(blob)
(OUT / 'airframe.bin.gz').write_bytes(gzip.compress(bytes(blob),compresslevel=9,mtime=0))
metadata = {'version': 3, 'source': 'FGUK / FGMEMBERS Su-27 (GPL-2.0), Su-35S exterior adaptation', 'authors': ['Lee Elliott', 'StuartC', 'VooDoo'], 'license': 'GPL-2.0-only', 'meshes': meshes, 'scales': [X_SCALE, Y_SCALE, SPAN_SCALE], 'sourceRevision': 'a9c4863886a5835dfa4406698dd4557fbf72a3aa'}
(OUT / 'airframe.json').write_text(json.dumps(metadata, separators=(',', ':')))
print('EXPORTED', len(blob), 'bytes', len(meshes), 'meshes', flush=True)

if '--bake' in sys.argv:
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = False
    scene.render.bake.margin = 24
    image = bpy.data.images.new('Su35 Ambient Occlusion', width=2048, height=2048, alpha=False)
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
