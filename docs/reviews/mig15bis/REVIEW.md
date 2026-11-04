# MiG-15bis implementation and review — 2026-11-04

Native aircraft 15 is selectable from Russia → Light Fighters → MiG-15bis, BR 8.5. This is an authored aircraft with an independent native definition, not a catalog alias. The clean combat configuration has NR-23 ×2 (160 rounds total) and N-37D (40 rounds), a dry VK-1, no radar/missiles/countermeasures/TVC, a real open nose duct, fixed-area tailpipe, conventional moving controls, speed brakes, gear, sliding canopy and damage/wreckage integration.

## Verification

All 18 required restore/build/regression commands in `checks.json` passed. The native rebuild and collision export are byte-identical. The new aircraft preserves all 15 preceding native trajectories over 18,000 ticks, survives 12 envelope cases, takes off intact from the existing runway in 23.4 seconds, reloads 200 rounds, inflicts native cannon damage through the fleet bridge and flies under native AI. Its whole magazine contains 160 23mm and 40 37mm native projectiles. Individual cannon timing is represented by a synchronized 35-round/s aggregate schedule, with separate per-projectile impact classes.

The inspector uses the same model. Both sides of the intake pass 12 recessed-entry ray tests. Frozen material coordinates follow moving controls and fractured pieces. Geometry checks pass for approximately 10.146 m span including nav lights, 10.133 m overall length including gun/tail extremities and 3.70 m on the contact plane. Neutral wingtip geometry has the 10.085 m nominal span. The stationary VK-1 exit has neither afterburner petals nor TVC; even an afterburner command cannot create an exhaust flame.

## Actual comparison and corrections

The photograph comparisons use the game geometry and its actual Three.js material hooks through EGL llvmpipe. `photo-rear/comparison.jpg` and `photo-side/comparison.jpg` place the photograph, a 45% render overlay, and a red silhouette side by side. Raw photos, licenses, the manual landmark correspondences, camera matrices and every pixel residual are preserved. Only rigid camera pose and focal length are fitted; neither photo nor geometry is warped.

The first overlay exposed an overlong fuselage and a fin placed too far forward with insufficient sweep. The fuselage was shortened to approximately 8.13 m while retaining the approximately 10.10 m overall tail extremity; fin sweep, tailplane placement, wing chord/planform and gear height were revised. `photo-rear-before` and `photo-side-before` retain the early diagnostic attempt. Their first canopy correspondences incorrectly treated the museum's sliding canopy as closed; the final registrations explicitly model it open. These initial overlays are diagnostic history, not a claimed like-for-like numerical accuracy score.

The final manual camera fit has RMS landmark residuals of approximately 20.1 px (rear) and 28.6 px (side) in 1200-pixel-wide photographs. Lens distortion, partial occlusion and uncertain hand-picked landmarks remain; this is a reconstruction, not manufacturer CAD or a tolerance certification. The fin and wingtip outline is much closer after the correction; canopy and landing-gear appearance still warrant a browser review with freely matched camera views.

`states/state-comparison.jpg` shows idle/open canopy, military power/gear up, deflected controls/brakes/gear down and a detached/scorched wing. The separate intake and nozzle close-ups in each state inspect inlet depth, splitter, three cannon muzzles, fixed tailpipe and lack of long flames. A flat star decal initially intersected the curved wing and produced hidden/striped paint; the final markings are subdivided and conformed to the airfoil. Number 23 is oriented correctly on both sides. The renderer also honors transparent depth writes and double-sided glass passes.

## Measured cost and limits

- Gear-down visible geometry: 47,442 triangles, 81 mesh draws before renderer culling, 46 material variants; 1,454,344 bytes of geometry/index/attribute data.
- No extra airframe image textures are allocated; the authored finite panel/normal/roughness/AO and paint layout is evaluated in frozen neutral metre coordinates. This excludes shared scene/environment resources.
- `web/mig15bis-model.js`: 14,188 source bytes; 6,165 bytes with gzip.
- `web/mig15bis-finish.js`: 4,220 source bytes; 1,697 bytes with gzip.
- The final native WASM is 325,232 bytes (122,440 bytes with gzip). GPU costs are data-size measurements in software EGL, not hardware FPS or timing claims.

The managed cloud browser was tried twice and reported `Error creating WebGL context.` Browser gameplay/desktop/mobile interaction QA is therefore **pending**, not passed. The queue remains `in_progress`, with native implementation and offline evidence committed; do not mark the aircraft `reviewed` until that final QA is done. The feature can be published with this explicit verification limit, while the pending quality review remains recoverable.
