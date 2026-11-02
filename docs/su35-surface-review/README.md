# Su-35S surface texture study

The model keeps the existing 52 / RF-81719 blue-grey livery and every geometry
buffer. The surface layout is an authored game reconstruction, not production CAD.
No War Thunder model or texture files are used.

## Public references and adaptation

Research uses the public Gaijin Dagor Engine documentation at revision
`2baf19472d60b96b437b2f9e549a3a6c8958cfd8`:

| Public technique | Applied here |
| --- | --- |
| [Microdetails in War Thunder](https://github.com/GaijinEntertainment/DagorEngine/blob/2baf19472d60b96b437b2f9e549a3a6c8958cfd8/_docs/source/assets/about-assets/microdetails/microdetails.md) | One shared 256² micro-normal/roughness tile adds paint grain; its contribution fades under minification. |
| [Packed vehicle normal/metalness/smoothness](https://github.com/GaijinEntertainment/DagorEngine/blob/2baf19472d60b96b437b2f9e549a3a6c8958cfd8/_docs/source/projects/wt/wt_designing_vehicle_deformations.md#assigning-dynamic-materials) | The browser adaptation packs tangent normal XY into RG, roughness into B, and baked occlusion/cavity into A. Normal Z is reconstructed; exposed engine metal uses a separate spatial mask. |
| [Base and detail normal layers](https://github.com/GaijinEntertainment/DagorEngine/blob/2baf19472d60b96b437b2f9e549a3a6c8958cfd8/_docs/source/assets/shaders/simple_aces_detailed.md) | The unique panel atlas and shared detail normal are combined in the fragment shader. Both follow the existing UVs or frozen neutral coordinates through control movement and wreckage. |
| [Texture formats, mipmaps and quality levels](https://github.com/GaijinEntertainment/DagorEngine/blob/2baf19472d60b96b437b2f9e549a3a6c8958cfd8/_docs/source/assets/about-assets/about_assets.md#texture-assets) | Full 4K UASTC/KTX2 atlas with thirteen mip levels, native ASTC/BC7/ETC2/BC3 transcode, anisotropic filtering and a 2K RGBA fallback. |

Unused UV background is kept neutral and islands have an eight-texel border to
keep the generated mip chain from introducing dark edges.

The old albedo-derived bump map is removed. Paint colours and printed graphics
are not treated as physical dents. Authored panel joints, shallow flush rivets,
access hatch borders, subtle sheet relief and local roughness variation are baked
to the unchanged UVs. The original Blender AO is combined into the packed atlas.
Occlusion affects indirect lighting, while the colour layer adds restrained
cavity staining. Normal variance broadens distant highlights to reduce shimmer.

## Resource budget

Only one atlas is shared by all skin materials and aircraft instances in a
renderer. The old standalone AO image is no longer loaded. The transcoder runs in
one short-lived worker, which is terminated after loading.

| Texture, including all mip levels | Previous GPU bytes | New GPU bytes |
| --- | ---: | ---: |
| 2K RGBA albedo | 22,369,620 | 22,369,620 |
| 2K RGBA AO / 4K block-compressed packed surface | 22,369,620 | 22,369,648 |
| 256² shared micro detail | 0 | 349,524 |
| Total, excluding the unchanged seat texture | 44,739,240 | 45,088,792 |

The increase is about 0.33 MiB (0.78%), with four times as many surface texels.
The uncompressed fallback uses a 2K atlas to retain the same memory budget.
This does not claim an FPS increase: browser regression uses SwiftShader.

Cold transfers for the new maps are recorded in
[the generated manifest](../../web/assets/su35/surface.json): approximately
7.73 MB for the gzip-wrapped 4K KTX2, 0.70 MB albedo WebP and 0.08 MB micro tile,
plus a reusable 0.58 MB transcoder. The 2K surface fallback is approximately
3.17 MB and does not require the transcoder. The larger 4K transfer is the tradeoff
for the higher unique detail resolution at the same GPU storage cost.

## Render review and verification

These unretouched browser captures use identical cameras and lighting:

| Area | Previous | New packed surface |
| --- | --- | --- |
| Wing skin | [Before](wing-before.png) | [After](wing-after.png) |
| Forward fuselage | [Before](nose-before.png) | [After](nose-after.png) |

The studio's **외피 상세** button, or `su35.html?view=surface`, opens the wing
surface directly. The same material factory is used in combat, the in-game
inspector and the independent flight demo.

Validation covers actual ASTC, BC7, ETC2 RGBA and BC3 uploads, all thirteen mip
levels, shared atlas identity, the 2K fallback and mobile in-game rendering. The
independent flight demo also passed its desktop/mobile controls and camera checks.
Geometry regressions retain 177,834 visible triangles, thirty matching collision
regions, stores, damage inheritance, wreckage and the open intake path.

## Reproduction

1. Build the existing airframe and AO with Blender as described in
   [the source README](../../assets/su35-source/README.md).
2. Install numpy, Pillow, scipy, g++, and the pinned encoder package:
   `npm install --prefix /tmp/apex-texture-tools @gpu-tex-enc/basis@1.16.4`.
   That package's Linux binary reports Basis Universal v1.15.
3. Set `BASISU=/tmp/apex-texture-tools/node_modules/.bin/basisu-linux-x64` and run
   `python3 scripts/su35/build_surface.py`. The rasterizer reads
   `assets/su35-source/surface-layout.json`, generates the packed maps and encodes
   the mip chain in linear data space. `-y_flip` matches the original WebGL UV
   orientation for compressed uploads.
4. Update the readable override manifest, restore the runtime, and run
   `tests/su35-surface-browser.py` plus the geometry/combat-model regressions.

Basis Universal transcoder: Apache-2.0. Three.js compatibility class: MIT.
The authored surface pipeline and derived model assets retain GPL-2.0-only.
The vendored licenses and editable source are included in the downloadable source.
