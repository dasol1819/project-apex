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

## Important: NOT integrated, NOT visually reviewed
- Conversion outputs exist only as **user-downloadable conversation artifacts**; GitHub currently has no GLB asset committed. Never claim this branch contains the binary.
- No animation stacks in source FBX. Wing sweep, gear, control surfaces, canopy and nozzle still require animation rigs.
- Landing gear is down in the imported pose; weapon stores and cockpit are included.
- Native flight/combat, damage, aircraft-tree registration, WebGL loader, model-to-reference overlays, actual rendered screenshots and deployment **not done**.
- Original geometry is 43k triangles, but numerous meshes and material calls (222 partitions) will require batching/LOD/resource QA.
- Converters used Pillow, NumPy, trimesh, scipy; validated glTF 2.0 GLB by importing both variants with trimesh. This is **not** a browser/shader QA pass.

## Next work
1. Upload the provided `mig23mld-game.glb` via a binary-capable GitHub workflow into the web asset tree (the GitHub text connector cannot import local sandbox binaries).
2. Rig the variable-sweep wings and gear correctly; allow wing sweep/control feedback and damage.
3. Integrate asynchronous GLTF loading in the existing Three.js runtime, and flight/weapons/tree data.
4. Compare *actual WebGL renders* against licensed exact-variant top/side/front/rear photos, record failures and corrections.
5. Run repository manifest/restore, native tests, and deploy only after a passing review.

Status: **in_progress**, not approved for release.
