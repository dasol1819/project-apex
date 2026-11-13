# MiG-23MLD original fixed-fin damage — 2026-11-13 Seoul

Scope: original fixed vertical fin / root fairing / fittings, native part 5. This is a component damage checkpoint, **not complete aircraft visual approval**. MiG-23MLD remains `in_progress`; preserve unfinished MiG-15bis and the initial 15-aircraft surface review. Separate PR #38 assisted-stick work is not modified.

## Source and exact-variant references

Tim Samedov (citizensnip), original MiG-23MLD GLB, CC BY 4.0, SHA-256 `eb1d5b3ea7a370e157b89061ade52eaa4e7536ce927852124e40bde94679d4b8`. Original binary, maps, attribution, editable project and prior review remain unchanged. No War Thunder assets or generated reference photographs are used.

Reopened 2026-11-13: [Jeff Keip's author-identified MLD walkaround](https://www.arcair.com/awa01/101-200/awa189-MiG-23-Keip/00.shtm), [49 upper fin / tip fittings](https://www.arcair.com/awa01/101-200/awa189-MiG-23-Keip/49.shtm), [51 opposite fin / lower fairing](https://www.arcair.com/awa01/101-200/awa189-MiG-23-Keip/51.shtm), [47 root / metal band / stabilator](https://www.arcair.com/awa01/101-200/awa189-MiG-23-Keip/47.shtm). The original images were downloaded and visually inspected privately; copyright 2000 Jeff Keip, linked rather than redistributed. Their visible fin/rudder seam, stacked upper fittings and lower bulb-shaped fairing establish separate details to inspect, not measured coordinates or certified fracture lines.

[Pima's exact-MLD record](https://pimaair.org/museum-aircraft/mig-23mld/) and [Estonian Aviation Museum's MLD record](https://www.lennundusmuuseum.ee/en/gallery/fighters/mig-23mld/) independently identify one R-35-300 engine. Museum overall dimensions differ in rounding/length convention; no nozzle, aerodynamic, mass or actuator coefficients were inferred from those figures.

## Implementation and correction from actual renders

The fin skin is embedded in `mig23mld_fuz` but forms seven disconnected source components: **673 triangles**. C++17 union/find selects whole triangles with a 10 micrometre weld quantization. Separate original nodes `OBJ0010`, `OBJ0011`, `OBJ0012` and `OBJ0017` contribute **299 triangles** for root/hinge fittings, for **972 total**. The original movable rudder remains part 20 and is excluded from the part-5 piece.

An initial 683-triangle render exposed a floating lower cone/fairing after fin destruction. Re-inspecting the original node bounds and Keip's lower-fin photograph identified the three omitted root fittings. They now disappear and detach with the fin. This was a visual defect caught after numerical topology checks passed; no full-aircraft approval is inferred from numeric tests.

Runtime compacts/remaps both triangle subsets. It preserves typed attribute values, UV aliases, normals, triangle winding, source material and local/world transforms. Merely retaining the entire fuselage vertex buffer behind a subset index would give incorrect fin bounds/emitters, so the detached source has only its own vertices. The immutable decoded model and other aircraft instances are unchanged. Healthy rendering adds one mesh and one group; no new triangles, vertices, maps or attribute-buffer bytes.

The native part-5 box is fitted to the original source, with a 2 mm numerical pad. Its pivot is `[-0.0006626061, 1.7626825426, 5.6085900971]`, half extents `[0.1244548646, 1.1326231462, 2.6988063999]` in gameplay aircraft metres. This is a conservative model envelope, **not** a measured aircraft centre of mass, hydraulic stop, hardware fracture boundary or triangle-exact collision surface. Native parents 29/0 suppress the source fin/rudder/fittings; rudder-only loss leaves the fixed fin intact. Other original fuselage/wing/gear damage partitions remain incomplete.

## Reproducible checks

- `node scripts/build-mig23-fin.mjs --check`: restores source normalization/gear contact frame, verifies the GLB hash, recompiles C++17 with warnings as errors, regenerates the deterministic JSON and runtime partition.
- `tests/mig23-fin-topology.mjs`: all **43,089 original triangles**, world positions, normals and every loaded UV attribute preserved; **71,214 vertices**, **2,537,382 buffer bytes** before/after; **222 → 223 meshes**. Wrong topology is rejected; sibling geometry remains independent.
- `tests/mig23-fin-native.mjs`: original part-5 removal/body profile; baseline comparison of **510 damage fixtures** (17 native types × 30 parts), excluding only the intended type-16 part-5 vector change.
- `tests/mig23-fin-combat.mjs`: real native gun/fleet-delivery path. Baseline misses this static high-fin shot; source-fit build hits part 5, health **1 → 0.8**, 28 ticks. The shot crosses two actual original skin triangles at y=2.7997, z=7.2089. Box contact precedes the skin because the native collider is conservative. This fixture does not certify AI aim or manoeuvring combat.
- `tests/mig23-fin-browser.py`: actual native gameplay, original mapped debris, intact/rudder-only/fin-loss/parent-loss/reset, source envelope and half-second native body follow, plus visible framebuffer submission. Final suite results and deployment are recorded in subsequent validation files; do not infer success from an uncompleted run.

Rebuilt native candidate: **344,687 bytes**, SHA-256 `ac0f479cb659f61c309277782834306aa9753c03fc58ce74dbefbeabd1fbe007`. The encoded base payload and tracked baseline WASM are unchanged; CI generates the candidate. Legacy flight, weapons, sweep, tail/nozzle damage and texture checks are required before merging.

## Photo overlap and resource limits

Re-run the current actual game capture through `scripts/review-mig23-tail-crop.py`; it overlays 48% on the preserved, unblended **US Navy/public-domain exact-MLD photograph crop**, with the existing full-aircraft similarity registration and no individual part warp. The original download is not re-created; the crop is a recorded JPEG reproduction. The nozzle is a registration anchor and cannot independently validate its size. Fin top/root and stabilator/camera residuals remain. Intake depth, overhead wing planform and active R-35 plume shape still need matched evidence.

Observed actual game resources: one aircraft **244 → 245 calls / 44,497 triangles**, two visual instances **466 → 468 calls / 87,572 triangles**. Shared source textures remain **22 GPU handles / 36 visible texture objects / estimated 183,074,056 RGBA8+mip bytes**. Renderer-wide texture counters differ by one; these also include unrelated render targets/effects and are not a driver VRAM measurement. Second-instance source fetches remain zero; mutable controls/materials/geometry and sibling disposal remain independent. Environment: Chromium 141, SwiftShader, 1366×900. Hardware FPS/VRAM and AI combat/flight remain unmeasured.

Next: finish all checks and publish only the validated branch; verify production bytes and actual production-response native fin damage. Then continue remaining original wing/control/fuselage/gear partitions and matched photo/camera work. No generic alias or incomplete model is promoted.
