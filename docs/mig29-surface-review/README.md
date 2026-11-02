# MiG-29 9.12 packed surface revision

The MiG-29 uses the same base/detail normal, roughness and occlusion approach as
[the Su-35S surface study](../su35-surface-review/README.md), including its public
Dagor research references. The aircraft retains its authored grey/green game
paint and red 24 markings. The panel layout is an authored reconstruction, not
production CAD. No War Thunder models or textures are distributed.

## Actual changes

- A dedicated non-overlapping UV chart replaces the original paint atlas for
  surface detail. The original atlas overlaps between components, which cannot
  reliably carry unique panel normals. The second UV stream follows every
  moving/detached part; paint UVs and all position/normal buffers are unchanged.
- A 4K atlas packs tangent-space normal XY, roughness and cavity/AO into RGBA.
  It includes shallow panel seams, flush rivet dimples, access hatch borders,
  small sheet variation and restrained cavity staining. Blender AO is baked
  against the new chart, rather than reusing the overlapping original AO.
- A 256² micro-normal/roughness tile provides fine paint grain. It fades under
  minification; normal variance broadens distant highlights to reduce shimmer.
- GPU-native ASTC/BC7/ETC2/BC3 keeps the atlas block-compressed, with thirteen
  mip levels. Unsupported devices use a 2K RGBA fallback. Eight-texel chart
  padding and a neutral unused background protect the mip chain from dark edges.
- The studio adds **외피 상세**, accessible at `mig29.html?view=surface`.

## Browser captures

The cameras and lighting are identical; these are unretouched game renders.

| Area | Previous | Packed surface |
| --- | --- | --- |
| Wing | [Before](wing-before.png) | [After](wing-after.png) |
| Nose | [Before](nose-before.png) | [After](nose-after.png) |

## Resource costs

The unique surface texture stays shared across all 27 skin materials and all
MiG instances in a renderer. The old standalone AO image is no longer loaded.

| GPU texture storage, including mipmaps | Before | After |
| --- | ---: | ---: |
| 1K albedo | 5,592,404 B | 5,592,404 B |
| 2K AO / 4K packed block-compressed surface | 22,369,620 B | 22,369,648 B |
| 256² micro detail | 0 B | 349,524 B |
| Total texture storage | 27,962,024 B | 28,311,576 B |

Texture storage increases about 0.33 MiB (1.25%). **The additional UV stream is
separate:** it adds 3,535,872 bytes to each model geometry. There are no additional
triangles; the visible model still has 238,896. This does not claim an FPS gain.
Browser regression uses SwiftShader and cannot establish hardware performance.

Cold transfers: approximately 6.53 MB compressed surface, 1.03 MB UV data,
0.065 MB albedo, 0.083 MB micro tile and a reusable 0.58 MB transcoder. The 2K
surface fallback is approximately 2.69 MB and requires no transcoder. A raw UV
fallback supports browsers without gzip streams. The higher cold transfer and
extra UV storage buy correct, higher-resolution surface mapping.

## Reproduction and verification

Install Blender 4.3, g++, numpy, Pillow and scipy. The pinned encoder is available
with `npm install --prefix /tmp/apex-texture-tools @gpu-tex-enc/basis@1.16.4`;
its Linux binary reports Basis Universal v1.15. Run:

```
BASISU=/tmp/apex-texture-tools/node_modules/.bin/basisu-linux-x64 python3 scripts/mig29/build_surface.py
```

`build_surface_uv.py` creates the supplemental UVs and AO; the shared
`scripts/airframe-surface` rasterizer bakes the MiG-specific authored profile.
The existing Su-35 entry point delegates to the same build tool with its own
profile. The Su-35's published textures are unchanged.

Run `tests/mig29-surface-data.mjs` and `tests/mig29-model.mjs` against a restored
runtime. `tests/mig29-surface-browser.py` checks real compressed uploads in all
supported formats, the 2K fallback, UV channel 1, shared texture identity, close-up
renders and mobile in-game inspection. Geometry regression covers dimensions,
underside continuity, clear intake rays, FOD sweeps, nozzle aperture, controls,
stores, matching collision regions and wreckage.

Original geometry: Detlef Faber and Gary R. Neely / FGMEMBERS MiG-29, GPL-2.0-only.
The editable build pipeline, panel layout, tests, licenses and review are included
in the downloadable source. Basis Universal: Apache-2.0; Three.js and its small
compressed-texture compatibility layer: MIT.
