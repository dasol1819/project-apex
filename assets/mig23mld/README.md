# MiG-23MLD external-asset intake — 2026-11-08

## Source and permission
- Original creator: **Tim Samedov** (Sketchfab `citizensnip`).
- Original model: https://sketchfab.com/3d-models/mig-23-mld-7a13c91f07e042a685b4d265644fdc06
- Repackaged ZIP location provided by user: https://ctrlassets.itch.io/mig23
- Original Sketchfab page advertises **CC BY** (credit creator, include license and changes); verify model and texture provenance before publishing.
- User supplied `mig23- model+texture.zip` in chat, containing `source/mig23mld.7z` with FBX mesh and PNG maps.

## Intake/conversion checks
- FBX 7400 (binary); 136 geometry nodes, 136 model nodes, 47 materials.
- 43,093 imported triangles; 22 referenced texture images.
- Converted and locally reimport-validated: **222** textured mesh parts in each GLB.
- `mig23mld-game.glb`: 6,948,004 bytes (up to 1024 px JPEG textures), SHA-256 begins `5dfda62a6681ef63a89e`.
- `mig23mld-high.glb`: 10,121,084 bytes (up to 2048 px JPEG textures), SHA-256 begins `aee958c5352333f16d20`.
- FBX local transforms applied, mesh centered and uniformly scaled to 16.70 m total length; +Y up, -Z forward, +X starboard.
- Initial left-wing upper-surface UV imbalance remapped from mirrored right-wing top UVs.
- Key meshes by original name: left variable wing `OBJ0257`; right variable wing `OBJ0264`. Exact pivot and other control surface partitions not yet validated.

## Current intake and preview status (2026-11-08)
- The user uploaded the original Blender `Mig-23.glb` (22,593,404 bytes) to `web/assets/mig23mld/Mig-23.glb` on branch `opensource-mig23mld-20261105`.
- The `Index MiG-23MLD GLB after an authorized upload` workflow succeeded and recorded the binary SHA-256 in `web/manifest.json`; this is the original Blender file, **not** the separate 6.45 MB optimized download.
- A glTF parser, 3D preview page, variable-sweep visual control and Russian tree preview link now exist in this PR. The aircraft still has `simId: null`, and cannot be selected or flown.
- Source FBX has no animation stacks. Wing sweep pivots are for visual inspection only; gear, control surfaces, canopy and nozzle are not fully rigged.
- No live deployment, actual WebGL/photo comparison or FPS/quality review has been recorded. Native flight, radar, weapons and damage integration are still unimplemented.
- The original model has many mesh/material draws; GPU resource measurements and LOD work remain to be done.

## Next work
1. Pass the current revision's manifest/restore and `tests/mig23mld-preview.mjs` checks; prior failed runs began before the GLB was indexed.
2. Verify actual browser WebGL rendering, texture orientation and correct variable-sweep hinge positions, and compare exact-variant photos.
3. Review source/texture attribution and resource cost, and only then merge the preview PR for Pages publication.
4. Build and test separate native flight/combat integration; do not classify the airframe as implemented until it is complete.

Status: **preview work in progress**; not flyable, not yet visually reviewed.


## Native flight integration — 2026-11-08 (supersedes preview-only status above)

PR: https://github.com/dasol1819/project-apex/pull/14

- Registered aircraft as native type **16** and MiG-23MLD in the Russian multirole tree. Source-backed original 22.59 MB GLB remains credited to Tim Samedov (CC BY 4.0).
- Reproducible 17th-aircraft WASM build via `scripts/native/build-mig23.mjs`; CI compiles and copies the resulting binary into public Pages output, preserving the original packed payload.
- Single R-35-300 engine, dry/afterburning nominal thrust 83.6/127.49 kN, fuel, hydraulic wing actuator and sweep-coupled lift/drag implemented in native flight. Native radar, missile stores and gear contact probes use documented approximate open-source/game parameters.
- Default game-assist automatic sweep selects 45° above 500 km/h IAS and returns to 16° below 400 km/h IAS; above Mach 1.1 it selects 72° and below Mach 1.0 it returns to 45°. Between these entry/exit thresholds it retains its commanded detent; native hydraulics move the wings at the existing finite rate. This user-selected schedule supersedes the earlier continuous Mach/G/gear schedule; manual detents 16°, 33°, 45°, 72° and AUTO return. The actual MiG-23 pilot selected wing angle manually; this automatic schedule is intentionally a game feature.
- Tests: `tests/mig23-native.mjs`, `tests/mig23-autosweep.mjs`, source GLB PBR tests, old native-aircraft regressions, desktop/mobile Chromium smoke. Browser QA must pass before merging.
- **Outstanding:** original GLB gear/canopy/control-surface partitions have no complete animation rig; native radar, missile, drag/stall envelope and single-engine damage coefficients remain approximations. Actual photo overlay verification and dedicated device GPU performance review remain outstanding. Do not mark exterior quality-reviewed based solely on native CI tests.

## Tail damage geometry profile

`tail-damage-shapes.json` is derived from the Tim Samedov (citizensnip) original MiG-23MLD GLB, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), SHA-256 `eb1d5b3ea7a370e157b89061ade52eaa4e7536ce927852124e40bde94679d4b8`. `docs/aircraft-review/mig23mld/tail-damage-vertices.csv` preserves its ordered gameplay-normalized source vertices in aircraft-local metres at visual actuator commands −0.6, 0 and +0.6 rad. `scripts/fit-mig23-tail-bounds.cpp` analytically encloses each rigid rotation arc, including interior extrema, with a 2 mm numerical pad. These are source-model collision/wreckage boxes, not measured aircraft dimensions, mass centres or verified hydraulic travel limits. Only native parts 3, 4 and 20 are replaced; original GLB/textures and the other profiles remain unchanged.

2026-11-12 nozzle damage profile: `nozzle-damage-shape.json` is derived from the original Tim Samedov CC BY 4.0 GLB after existing game normalization/ground alignment and the current linear radial nozzle morph. Editable samples: `docs/aircraft-review/mig23mld/nozzle-damage-vertices.csv`; C++17 source: `scripts/fit-mig23-nozzle-bounds.cpp`. This source-model collision box with 2 mm numerical padding is not a measured aircraft dimension or physical actuator limit. No original mesh, map, UV or encoded payload is replaced.
