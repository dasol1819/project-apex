"""Bake aligned RG-normal/B-roughness/A-AO maps without adding geometry.
SPDX-License-Identifier: GPL-2.0-only
Requires numpy, Pillow, scipy, g++, and a Basis Universal CLI (BASISU).
"""

import gzip, hashlib, json, os, subprocess
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt, gaussian_filter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "web/assets/su35"
BUILD = ROOT / ".native-build/su35-surface"
BUILD.mkdir(parents=True, exist_ok=True)
layout = json.loads((ROOT / "assets/su35-source/surface-layout.json").read_text())
planes = ["top", "bottom", "side", "fin"]
lines = []
hatches = []
for i, p in enumerate(planes):
    for a, b in layout[p]:
        lines.append("{" + ",".join(map(str, [i, *a, *b])) + "}")
for h in layout["hatches"]:
    hatches.append(
        "{"
        + ",".join(map(str, [planes.index(h["plane"]), *h["center"], *h["half"]]))
        + "}"
    )
(BUILD / "surface_layout.h").write_text(
    "struct Line{int plane;float ax,ay,bx,by;};\nconst Line LINES[]={"
    + ",".join(lines)
    + "};\nstruct Hatch{int plane;float x,y,rx,ry;};\nconst Hatch HATCHES[]={"
    + ",".join(hatches)
    + "};\nconst float RIVET_PITCH="
    + str(layout["rivetPitch"])
    + "f;\n"
)
meta = json.loads((OUT / "airframe.json").read_text())
binary = (OUT / "airframe.bin").read_bytes()
tri = []
for m in sorted(meta["meshes"], key=lambda x: x["position"]["count"]):
    if m["material"] != "skin":
        continue
    arrays = [
        np.frombuffer(
            binary, dtype="<f4", offset=m[n]["offset"], count=m[n]["count"]
        ).reshape(-1, w)
        for n, w in [("position", 3), ("normal", 3), ("uv", 2)]
    ]
    tri.append(np.concatenate(arrays, axis=1))
np.concatenate(tri).astype("<f4").tofile(BUILD / "triangles.bin")
subprocess.run(
    [
        "g++",
        "-O3",
        "-std=c++17",
        "-I",
        str(BUILD),
        str(ROOT / "scripts/su35/bake_surface.cpp"),
        "-o",
        str(BUILD / "bake"),
    ],
    check=True,
)
subprocess.run(
    [
        str(BUILD / "bake"),
        str(BUILD / "triangles.bin"),
        str(BUILD / "surface.rgba"),
        "4096",
    ],
    check=True,
)
a = np.fromfile(BUILD / "surface.rgba", dtype=np.uint8).reshape(4096, 4096, 4).copy()
mask = a[:, :, 3] > 0
# Eight texels of island padding prevent dark UV edges in the filtered mip chain.
dist, idx = distance_transform_edt(~mask, return_indices=True)
padding = (dist <= 8) & ~mask
a[padding] = a[idx[0][padding], idx[1][padding]]
a[dist > 8] = [128, 128, 174, 255]
del dist, idx
baseAO = (
    np.asarray(
        Image.open(OUT / "ao.png")
        .convert("L")
        .resize((4096, 4096), Image.Resampling.BILINEAR),
        dtype=np.float32,
    )
    / 255
)
a[:, :, 3] = np.round(a[:, :, 3].astype(np.float32) * np.maximum(0.15, baseAO)).astype(
    np.uint8
)
# Unused UV background is neutral, so distant mips cannot introduce dark seams.
a[~(mask | padding), 3] = 255
Image.fromarray(a).save(BUILD / "surface.png", compress_level=6)
# Full resolution stays block-compressed on supported GPUs; the fallback is 2K.
Image.fromarray(a).resize((2048, 2048), Image.Resampling.LANCZOS).save(
    OUT / "surface-fallback.webp", lossless=True, method=6
)
# A small shared micro-normal tile supplies sub-millimetre paint grain.
rng = np.random.default_rng(35152)
h = gaussian_filter(rng.normal(0, 1, (256, 256)).astype(np.float32), 0.7, mode="wrap")
h *= 0.000010 / max(h.std(), 1e-8)
dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) / (2 * 0.14 / 256)
dy = (np.roll(h, 1, 0) - np.roll(h, -1, 0)) / (2 * 0.14 / 256)
n = np.stack([-dx, -dy, np.ones_like(h)], axis=-1)
n /= np.linalg.norm(n, axis=-1, keepdims=True)
micro = np.empty((256, 256, 4), dtype=np.uint8)
micro[:, :, :2] = np.round((n[:, :, :2] * 0.5 + 0.5) * 255)
micro[:, :, 2] = np.clip(176 + h * 600000, 140, 215)
micro[:, :, 3] = 255
Image.fromarray(micro).save(OUT / "micro-surface.webp", lossless=True, method=6)
Image.open(OUT / "albedo.png").convert("RGB").save(
    OUT / "albedo.webp", quality=94, method=6
)
encoder = os.environ.get("BASISU", "basisu")
subprocess.run(
    [
        encoder,
        "-file",
        str(BUILD / "surface.png"),
        "-output_file",
        str(BUILD / "surface.ktx2"),
        "-ktx2",
        "-uastc",
        "-uastc_level",
        "2",
        "-uastc_rdo_l",
        ".4",
        "-uastc_rdo_m",
        "-ktx2_no_zstandard",
        "-linear",
        "-mipmap",
        "-mip_linear",
        "-y_flip",
    ],
    check=True,
)
data = (BUILD / "surface.ktx2").read_bytes()
(OUT / "surface.ktx2.gz").write_bytes(gzip.compress(data, compresslevel=9, mtime=0))
files = [
    "surface.ktx2.gz",
    "surface-fallback.webp",
    "micro-surface.webp",
    "albedo.webp",
]
report = {
    "version": 1,
    "geometrySha256": hashlib.sha256((OUT / "airframe.bin").read_bytes()).hexdigest(),
    "layoutSha256": hashlib.sha256(
        (ROOT / "assets/su35-source/surface-layout.json").read_bytes()
    ).hexdigest(),
    "layout": "RG=OpenGL tangent normal XY; B=perceptual roughness; A=occlusion/cavity",
    "compressedSize": [4096, 4096],
    "fallbackSize": [2048, 2048],
    "microSize": [256, 256],
    "geometryAdded": 0,
    "compressedGpuBytesIncludingMips": sum(
        max(1, ((4096 >> i) + 3) // 4) ** 2 * 16 for i in range(13)
    ),
    "files": {
        n: {
            "bytes": (OUT / n).stat().st_size,
            "sha256": hashlib.sha256((OUT / n).read_bytes()).hexdigest(),
        }
        for n in files
    },
}
(OUT / "surface.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report), flush=True)
