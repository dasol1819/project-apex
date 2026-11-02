"""Build a second, non-overlapping UV atlas without changing any flight geometry.
Run with Blender 4.3; original paint UVs remain untouched.
SPDX-License-Identifier: GPL-2.0-only
"""

import array, gzip, hashlib, json, math
from pathlib import Path
import bpy, bmesh, numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "web/assets/mig29"
BUILD = ROOT / ".native-build/mig29-surface"
BUILD.mkdir(parents=True, exist_ok=True)
meta = json.loads((OUT / "airframe.json").read_text())
data = (OUT / "airframe.bin").read_bytes()
records = []
positions = []
for i, m in enumerate(meta["meshes"]):
    if m["material"] != "skin":
        continue
    d = m["position"]
    p = (
        np.frombuffer(data, dtype="<f4", offset=d["offset"], count=d["count"])
        .reshape(-1, 3)
        .copy()
    )
    records.append((i, len(positions), len(p), m["name"]))
    positions.extend(p.tolist())
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
mesh = bpy.data.meshes.new("MiG29 independent surface chart")
mesh.from_pydata(
    positions, [], [(i, i + 1, i + 2) for i in range(0, len(positions), 3)]
)
mesh.update()
a = mesh.attributes.new("source_triangle", "INT", "FACE")
for i, d in enumerate(a.data):
    d.value = i
bm = bmesh.new()
bm.from_mesh(mesh)
bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
bm.to_mesh(mesh)
bm.free()
obj = bpy.data.objects.new("MiG29 packed surface UVs", mesh)
bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(
    angle_limit=math.radians(66),
    island_margin=0.003,
    area_weight=0,
    correct_aspect=True,
    scale_to_bounds=True,
)
bpy.ops.object.mode_set(mode="OBJECT")
uv = np.zeros((len(positions), 2), dtype="<f4")
pos = np.asarray(positions, dtype=np.float32)
for face in mesh.polygons:
    src = mesh.attributes["source_triangle"].data[face.index].value
    old = pos[src * 3 : src * 3 + 3]
    for loop in face.loop_indices:
        v = np.asarray(
            mesh.vertices[mesh.loops[loop].vertex_index].co, dtype=np.float32
        )
        corner = int(np.argmin(np.sum((old - v) ** 2, axis=1)))
        uv[src * 3 + corner] = mesh.uv_layers.active.data[loop].uv
blob = bytearray()
entries = []
for i, offset, count, name in records:
    values = uv[offset : offset + count].tobytes()
    entries.append({"index": i, "name": name, "offset": len(blob), "count": count * 2})
    blob.extend(values)
(OUT / "surface-uv.bin").write_bytes(blob)
(OUT / "surface-uv.bin.gz").write_bytes(
    gzip.compress(bytes(blob), compresslevel=9, mtime=0)
)
(OUT / "surface-uv.json").write_text(
    json.dumps(
        {
            "version": 1,
            "geometrySha256": hashlib.sha256(data).hexdigest(),
            "binarySha256": hashlib.sha256(blob).hexdigest(),
            "channel": 1,
            "meshes": entries,
        },
        indent=2,
    )
    + "\n"
)
mat = bpy.data.materials.new("MiG29 UV AO")
mat.use_nodes = True
image = bpy.data.images.new("MiG29 surface AO", width=2048, height=2048, alpha=False)
image.generated_color = (1, 1, 1, 1)
image.colorspace_settings.name = "Non-Color"
node = mat.node_tree.nodes.new("ShaderNodeTexImage")
node.image = image
mat.node_tree.nodes.active = node
mesh.materials.append(mat)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 32
scene.render.bake.margin = 16
bpy.ops.object.bake(type="AO", use_clear=True)
image.filepath_raw = str(BUILD / "surface-ao.png")
image.file_format = "PNG"
image.save()
print("SURFACE UV", len(blob), "bytes", len(entries), "meshes; AO baked", flush=True)
