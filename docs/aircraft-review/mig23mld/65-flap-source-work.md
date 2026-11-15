# Authored trailing flap work — 2026-11-15 Seoul

Resume the same unfinished MiG23MLD. Original OBJ0260/0270 and OBJ0267/0271 are the inboard and outer trailing flap skin,112 triangles and6 mapped meshes per side. Exact-MLD Jeff Keip photographs20/21 show the slot and segmented trailing surfaces;22/23 are neighbouring leading-edge context. These copyrighted photographs were fetched privately and are not redistributed:

- https://www.arcair.com/awa01/101-200/awa189-MiG-23-Keip/20.shtm
- https://www.arcair.com/awa01/101-200/awa189-MiG-23-Keip/21.shtm
- https://www.arcair.com/awa01/101-200/awa189-MiG-23-Keip/22.shtm
- https://www.arcair.com/awa01/101-200/awa189-MiG-23-Keip/23.shtm

C++17 fits each authored pin from eight welded source vertices along a5.083m line. The approximately9micrometre source residual is an asset-fit result, not aircraft survey precision. Source geometry, normals, UVs, maps and GLB hash are preserved. Native leftFlap/rightFlap outputs drive the source hinges. The existing gear-linked0..25degree game controller is preserved; it is not a claim that the real aircraft has a25degree maximum or this automatic schedule. Verified aircraft manuals/limits and independent flap commands remain outside this change.

Register real source parts16/17 instead of two empty placeholders, leaving six other child slots provisional. Each wing-root piece now excludes its separately destroyed112-triangle flap; combined root+flap retains636/665 original triangles without duplicated source skin. Whole root and independent flap/parent/reset, cached and held-first-source cases must pass before publication. Native flap envelopes follow live wing sweep and conservatively enclose all existing game0..25degree positions. The1degree support sampling has a recorded25micrometre arc-deviation bound inside the2mm pad. This is an AABB, not triangle collision, measured mass centre or certified aircraft dimensions.

Local native validation covers3,350,170 source vertex observations at62 native sweep settings and101 flap angles, with all510 other damage-body fixtures unchanged. An actual-renderer test caught the disabled source hinge returning to neutral on a synthetic post-loss input; freezing now also respects native health, while first late arrival replays the frozen native position once. Initial corrected renderer checks pass: native0/transit/25,112 mapped-triangle debris per side, fixed wing/opposite flap preserved and reset. Six native upward gun/fleet fixtures pass; baseline comparisons, full existing regressions, real photo overlap, CI and deployment remain pending. Keep aircraft in_progress; preserve PR38, MiG15bis and initial15 review.
