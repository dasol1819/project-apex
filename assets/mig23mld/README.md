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
