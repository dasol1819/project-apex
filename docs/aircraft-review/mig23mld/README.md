# MiG-23MLD R-35 exhaust and exterior review · 2026-11-09

The game uses Tim Samedov’s [MiG-23MLD GLB](https://sketchfab.com/3d-models/mig-23-mld-7a13c91f07e042a685b4d265644fdc06), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). This checkpoint retains the original GLB, materials, texture data and attribution. The runtime animates the existing `soplo` petals. [Pima Air & Space Museum’s MiG-23MLD specification](https://pimaair.org/museum-aircraft/mig-23mld/) identifies one R-35-300 and 28,700 lbf of afterburning thrust.

## Photo registration and observations

Chromium 141 with SwiftShader rendered the actual gameplay aircraft factory and licensed asset, with the group at its local origin. The camera used a 30° vertical field of view and aimed at `[0,-.12,0]`. Each image combines the photograph with a 48% render using one similarity transform. The cyan marks show the two registration points. Focal length, perspective, sweep and equipment vary by reference. These images support a visual review of visible shapes.

| Comparison | Photo and camera | Observations |
| --- | --- | --- |
| [In-flight side overlay](01-flight-side-overlay.jpg) | [US Navy 1986 Flogger-K no. 34](https://commons.wikimedia.org/wiki/File:MiG-23MLD.jpg), US public domain. Camera `[23,-4,4.4]`, sweep 72°. | Radome and aft lip anchors align. The radome shoulder and upper fuselage roughly follow the photo. The canopy and fin have visible residuals. The wing and stabilator outlines diverge near the trailing edges. The photo shows the unfolded ventral fin and gear up. The model displays parked gear, a belly tank and different stores. |
| [Intake and gear overlay](02-intake-gear-overlay.jpg) | [George Chernilevsky, Vinnytsya no. 40, G4](https://commons.wikimedia.org/wiki/File:MiG-23MLD_2008_G4.jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Camera `[18,-3,-6]`, sweep 72°. | The model intake lip and wing-root edge shift against the photo after registering the radome and nose wheel. The museum intake cover obscures the throat and splitter. The canopy arch and main wheel locations differ. The main door, exposed strut and wheel still need separate rig review from below. |
| [Rear quarter overlay](03-aft-overlay.jpg) | [George Chernilevsky, Vinnytsya no. 40, G7](https://commons.wikimedia.org/wiki/File:MiG-23MLD_2008_G7.jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Camera `[15,-2.7,10]`, sweep 72°. | The outer nozzle is a single circular assembly below the stabilators. The red museum cover obscures its inner opening. The tail height, stabilator edges, aft ventral profile, airbrake seams and main wheel placement have visible residuals. The registration cannot separate perspective error from individual geometry error. |

G4 and G7 were resized and overlaid with an aligned game render and annotations. Those composites are distributed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The original photographs remain available at the linked sources.

## Exhaust correction and runtime cost

[Before and after at the same camera and full afterburner](04-afterburner-before-after.jpg) uses camera `[7,2,25]` and 72° sweep. The original effect started at `[0,-.02,7.75]` while the GLB lip was centred at approximately `[-.00148,-1.05762,7.75478]` in game metres. The corrected effect now takes its position from that mesh. The tapered, decaying shock-cell effect starts at the lip and the petal tips open at afterburner. The dry nozzle contracts by up to 10% at the lip as a visual estimate. The effect responds to the native afterburner level, engine enable state, engine health and nozzle health.

| Chromium audit | Prior model | Corrected model |
| --- | ---: | ---: |
| Dry draw calls | 223 | 223 |
| Full afterburner draw calls | 226 | 224 |
| Full afterburner submitted triangles | 43,575 | 43,475 |
| Source GLB bytes | 22,593,404 | 22,593,404 |

The audit verified the typed damage buffers and effect suppression with the engine disabled or the nozzle destroyed. The 335,087-byte native build and flight, combat, surface, PBR and queue regressions passed locally. Counts were taken from the render harness with the game aircraft factory and contain no terrain or cockpit UI. Physical GPU FPS and thermal-plume dimensions are pending. No exact-variant photo in this review shows an active afterburner plume, so the flame profile remains an artistic approximation.

## Resume

Continue with true gear and door motion, stabilators and airbrakes. Use an uncovered forward photo for intake lip and splitter geometry and a matched overhead view at a known sweep for the wings. Measure the aft control surface and ventral profiles with a second aligned view. Confirm the exhaust internals and plume against uncovered and lit R-35 references. Verify GPU performance and combat damage before marking the complete aircraft reviewed.

The [native sortie screenshot](05-native-sortie.jpg) records the player aircraft in the actual game after selecting type 16 and commanding afterburner. The complete desktop and mobile smoke passed with an anonymous account-session fixture. In the runway capture, the belly and wheel contact height still need matching against the native gear geometry. The model-only before/after image above holds the camera and afterburner level fixed for the plume comparison.

## Logarithmic depth follow-up

The [airborne game renderer comparison](06-log-depth-game-comparison.jpg) uses the native type 16 at approximately 11 km altitude, with afterburner above 65%. The original effect rendered in the isolated test, but the game depth-tested it with a different depth mapping. The corrected shader uses the renderer's logarithmic-depth chunks. A Chromium regression renders one scene twice from the same camera with only the plume visibility toggled. The baseline returned identical frames. With the depth fix the frames differ and the plume is visible from the authored nozzle. The camera is a test-only inspection view.

PR #18 was deployed by [GitHub Pages](https://github.com/dasol1819/project-apex/actions/runs/42636625933). Its JavaScript checksum matched over the custom domain's HTTP endpoint. The HTTPS endpoint returned HTTP 503 from this environment.

## Runway contact alignment · 2026-11-10

The original render used the midpoint of the GLB bounding box as the gameplay origin. At that origin the two main tyres reached about −2.489 m while the native contact probes used −1.420 m. The runtime now measures the two authored tyre meshes and translates the original render root upward by about 1.069 m. The nozzle is anchored after this translation. The native contact coordinates, spawn, suspension and flight module retain their prior values.

| Wheel | GLB node | Original bottom (m) | Corrected bottom (m) | Native probe (m) |
| --- | --- | ---: | ---: | ---: |
| Nose twin wheels | `OBJ0041` | −2.434 | −1.365 | −1.420 |
| Main tyre, negative X | `OBJ0109` | −2.489 | −1.420 | −1.420 |
| Main tyre, positive X | `OBJ0131` | −2.489 | −1.420 | −1.420 |

[Runway comparison](07-runway-contact-comparison.jpg) shows the actual game renderer and native type 16 on its runway with the same body-relative test camera. The fuselage and lower gear are clearer after the correction. Tyres still partially intersect the runway in the rolling capture. Check the native suspension pose and rendered wheel clearance together. The 5.5 cm static nose offset and the fore-aft and track discrepancies remain for the gear rig.

The [earlier registered G4 photograph](02-intake-gear-overlay.jpg) and [Vinnytsya no. 40 main gear close-up](https://commons.wikimedia.org/wiki/File:MiG-23MLD_2007_G7.jpg) show the exposed actuator, linkage, fuselage door and wheel fairing. The latter was photographed by George Chernilevsky and is available under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The authored wheel and door pieces are visible in the new runway capture. Perspective and the different stance limit the comparison. The [Bulgarian Academy of Sciences linkage study](https://bjed.tu-sofia.bg/items/BJED-0033%282017%29.pdf) provides a mechanism reference for the separate pivots. Verify travel against exact-variant footage before choosing the retraction path.

The game reads tyre vertices once during loading. The correction adds 484 source JavaScript bytes and uses the same meshes, textures and draw submissions. The 22,593,404-byte source GLB and the 335,087-byte generated native WASM retain their previous SHA-256 checksums. Chromium/SwiftShader verified the local contact positions against the native type 16 probes and passed the mobile and live plume regression. Manifest/restore, native build and 16 regression scripts passed locally.

## Gear-linked ventral fin · 2026-11-10

The original GLB's `OBJ0024` is the folded aft fin. The runtime attaches that mesh to a hinge through the centres of its two mounting pads. Its down-to-up rotation follows the native gear travel continuously. With gear down it retains the authored starboard-folded position. With gear up it rotates 90° downward. The model supplies the hinge coordinates and the angle is a visual approximation. The physical fin, damage model and flight dynamics require further verification.

[Jeff Keip's MiG-23MLD left](https://www.arcair.com/awa01/101-200/awa189-MiG-23-Keip/10.shtm) and [right](https://www.arcair.com/awa01/101-200/awa189-MiG-23-Keip/11.shtm) close-ups show the folded panel, hinge and fixed housing. The [Szolnok museum's MiG-23MLD documentation](https://www.repulomuzeum.hu/Leltar/Leltarfotok/MiG-23.htm) confirms that the lower fin folds when gear is lowered. The [new photo overlay](08-ventral-fin-photo-overlay.jpg) registers the deployed-fin render against the US Navy's 1986 in-flight MiG-23MLD no. 34 photograph by the nozzle lip and radome tip. The rendered fin now occupies the lower aft silhouette in that photograph. The rear edge still has a visible residual. The camera and model paint, wing angle and stores differ across the images. References were checked on 2026-11-10. The Keip photographs are linked for reference.

In Chromium 141 / SwiftShader, the fin's lowest vertex relative to the flight origin was −0.782 m folded, −1.185 m halfway and −1.380 m deployed. The [native gear control capture](09-ventral-fin-in-game.jpg) records the gameplay renderer before and after a normal gear-up command. The nose and main wheel meshes remain visibly extended and require their own rig. On the same isolated model camera, all three poses submitted 43,091 triangles and 223 draw calls. The change adds a single transform node and 844 source JavaScript bytes. Source GLB and native WASM checksums match the prior build.

The manifest/restore, native build and 16 regression scripts passed. The Chromium smoke covers gear down, intermediate native travel and gear up, alongside runway contacts, live afterburner and the mobile selector.

## Nose gear retraction · 2026-11-10

The original CC BY 4.0 GLB already separates the nose strut, twin-wheel assembly, small linkage piece and left and right door shells. The gameplay model now articulates those meshes using the native gear travel. The strut rotates aft about the transverse pin. Both doors stay open during wheel travel and close independently after the tyres clear the opening. Reversing the native gear command reverses that sequence. The fit uses the authored hinge lines and an approximately 92° strut rotation. This is a visual rig driven by the existing simulation state.

[Keip's MiG-23MLD nose bay photograph](https://www.arcair.com/awa01/101-200/awa189-MiG-23-Keip/08.shtm) shows the open doors and linkage. His [frontal view](https://www.arcair.com/awa01/101-200/awa189-MiG-23-Keip/09.shtm) shows the twin tyres and offset strut details. The deployed game geometry has the same twin-wheel arrangement and separate longitudinal doors. The bay fittings and texture finish still differ. The source photos were inspected on 2026-11-10. The [in-flight MiG-23MLD no. 34](https://commons.wikimedia.org/wiki/File:MiG-23MLD.jpg) supplies an exterior check for the clean nose silhouette. The authored bay and [aircraft variant description](https://wofmd.com/2018/07/26/mikoyangurevich-mig-23mld/) agree on aft retraction.

The [gameplay sequence](10-nose-gear-in-game.jpg) captures extended, moving and closed positions using the normal gear control. The first isolated close-up exposed a 218 mm centre gap, measured between the inner x extents. Repositioning the door hinges to their upper authored edge reduced that gap to about 0.1 mm at the closest points, with a small visible aft-end seam. The retracted twin tyres cleared the door plane vertically by at least 108 mm in the measured pose. Exact door timing, suspension compression and physical tolerances remain unverified.

The nose rig adds three transform nodes and 1,145 source JavaScript bytes. It reuses the original mesh and texture data. The isolated nose camera in Chromium 141 / SwiftShader submitted 156 calls and 40,049 triangles extended, and 157 calls and 40,077 triangles stowed, with view frustum culling enabled. Manifest/restore, the native rebuild and 16 regression scripts passed. Chromium desktop verified extension, transit, stow and re-extension. Mobile selection, live plume and contact-plane checks passed. Original GLB and generated WASM hashes match the prior build.

The main wheel and door rig, physical clearance during taxi, additional control surfaces and full exterior review remain in progress.

## Main landing gear retraction · 2026-11-11

The original GLB separates the main tyres, wheel fairings, upper and lower bay doors, beam, and hydraulic actuator geometry. Both sides now articulate with native gear travel. The beam and wheel carrier share their joint. The wheel moves up and inward while the beam rolls into the bay. The actuator points to its moving attachment and the rod slides with the stroke. The forward cover follows the beam and aligns with the bay edge near closure. The two body doors close after the wheel clears them. Reversing the gear command reverses the sequence.

[Jeff Keip’s left bay](https://www.arcair.com/awa01/101-200/awa189-MiG-23-Keip/03.shtm), his [right bay](https://www.arcair.com/awa01/101-200/awa189-MiG-23-Keip/07.shtm) and [George Chernilevsky’s MiG-23MLD photo](https://commons.wikimedia.org/wiki/File:MiG-23MLD_2007_G7.jpg) were inspected on 2026-11-11. They show the offset beam, telescoping actuator and separate wheel fairing. [Metodiev’s kinematics paper, Figure 9](https://bjed.tu-sofia.bg/items/BJED-0033%282017%29.pdf) and the [family-level retraction footage](https://www.homemadetools.net/forum/mig-23-landing-gear-gif-79064) informed the compound motion and door order. Only the game renders are reproduced here.

The closed lower and upper doors were registered against the fuselage using 16 and 6 unique matching exterior UV vertices, respectively. Close-up Chromium renders exposed an opening beside the forward cover and a beam end crossing the lower door. The revised cover pose and beam roll reduced those issues. A seam below the forward cover and some differences in the bay fittings remain visible. The folding path is a visual fit to the authored asset. Exact aircraft linkage geometry, damage and all intermediate clearances remain to be verified.

[Native gear-control captures](11-main-gear-in-game.jpg) show the extended, moving and stowed positions. The test checks the real gear command in both directions, bilateral symmetry, wheel travel and delayed door closure. The measured starboard carrier joint moved from approximately `[0.938,-0.593,1.706]` to `[0.591,0.355,1.705]` m in game coordinates. The static main tyre bottoms remain at the native −1.420 m probe plane. In the isolated close-up Chromium 141 / SwiftShader submitted 112 calls and 13,789 triangles at each sampled pose. The runtime adds 14 transform nodes and 4,245 source JavaScript bytes, with the original GLB, texture and native source preserved.

Manifest/restore, the 343,744-byte native rebuild, 17 regressions including the current missile calibration, and actual Chromium desktop and mobile smoke passed. Taxi clearance, stabilators, airbrakes and full exterior review remain open.

## Native tail controls and registered comparison · 2026-11-11

The authored `stab2`, `stab` and `rudder` meshes now follow native type 16 control outputs. The slab tails have separate mirrored swept shafts and accept the native differential roll outputs as well as symmetric pitch. The single rudder follows `leftRudder`, the native single-fin channel. Disabled control parts retain their last pose. Three transform nodes preserve the original vertices, UVs, materials and textures. Physical separation, crushing and wreckage are still pending.

[Samara University's MiG-23 structure chapter](http://cnit.ssau.ru/operenie/o8_2.htm) describes the shaft through approximately 50% of the root chord, at about 45° to the fuselage side. Its photographs show the outer and inner bearings. Those are family-level construction references. [Jeff Keip's exact MLD right tailplane](https://www.arcair.com/awa01/101-200/awa189-MiG-23-Keip/47.shtm), [upper aft fin](https://www.arcair.com/awa01/101-200/awa189-MiG-23-Keip/49.shtm) and [starboard fin](https://www.arcair.com/awa01/101-200/awa189-MiG-23-Keip/51.shtm) show the slab, fixed root fairing and swept rudder boundary. All were inspected on 2026-11-11. Keip's copyrighted photographs are linked. The installed shaft positions are fitted to the authored model; exact MLD actuator limits and clearances are not certified by these photographs.

[Six actual game-renderer poses](12-native-tail-controls.jpg) use native simulation inputs of ±0.65 with FBW off. The native pitch outputs were approximately ±16.25°, differential roll outputs −3.58°/+3.58°, and the rudder outputs ±19.50°. The inboard trailing-edge probes rose 0.273 m for positive pitch and fell 0.266 m for negative pitch. Positive roll moved the port probe down 0.060 m and starboard up 0.060 m. The rudder trailing tip moved approximately 0.150 m to either side. These measurements describe this visual rig and sampled native outputs, not aircraft flight-test data. The regression also exercises normal native gear controls, the live plume framebuffer, runway contacts and the mobile selector. The inspection camera follows the aircraft, so its world lighting and background vary with native attitude.

The [new registered overlay](13-tail-photo-overlay.jpg) combines the original [US Navy's 1986 MLD no. 34](https://commons.wikimedia.org/wiki/File:MiG-23MLD.jpg) with the actual game renderer, using the nozzle-lip centre and pitot tip as landmarks. One uniform scale/rotation/translation and 48% alpha apply to the complete render. No individual part is warped. The render's neutral controls, 72° wing sweep and different stores are recorded. The photograph's precise control position, sweep, focal length and attitude are unknown.

The deployed gear now leaves a clean airborne silhouette. The slab-tail arrangement and separate rudder follow the visible MLD layout. The overlay still exposes a higher fin tip, differences at the stabilator aft edge and ventral-fin rear outline, and residuals at the canopy, wing and intake region. The exhaust lip is an alignment anchor, so it is not an independent dimensional validation. This view cannot validate intake depth or an active plume. Obtain an additional matched overhead and uncovered intake/exhaust view before changing those shapes or approving the complete aircraft. The moving slab/root-fairing clearance also needs a closer second view through full travel.

The editable [registration recipe](tail-overlay-recipe.json), [control measurements](12-tail-control-measurements.json) and [`scripts/review-mig23-tail.py`](../../../scripts/review-mig23-tail.py) reproduce the evidence from the original Navy photo and the browser-test PNGs. The photograph is US public domain. The rendered model retains Tim Samedov's CC BY 4.0 attribution. Rebuild with:

```sh
python3 scripts/review-mig23-tail.py --captures /tmp/mig23-flight-browser --photo /path/to/MiG-23MLD.jpg --recipe docs/aircraft-review/mig23mld/tail-overlay-recipe.json --output docs/aircraft-review/mig23mld
```

Chromium 141.0.7390.37 / SwiftShader measured 223 aircraft calls and 43,091 aircraft triangles in the dry side view (248 calls and 44,975 triangles for the complete scene). The tail rig adds 1,563 JavaScript bytes, three transform nodes, zero meshes and zero texture bytes. Source GLB remains 22,593,404 bytes, SHA-256 `eb1d5b3ea7a370e157b89061ade52eaa4e7536ce927852124e40bde94679d4b8`. Manifest/restore, the deterministic native build, 17 regressions and real desktop/mobile browser checks passed. Hardware GPU FPS remains unmeasured.

Before this rig, [PR #25](https://github.com/dasol1819/project-apex/pull/25) fixed the single R-35's inherited twin-engine lateral thrust arm. Independent local replay passed all four neutral-rudder takeoffs: FBW off/on × military/afterburner. Maximum yaw deviation was 0.000728 rad (0.042°), lateral drift 0.726 m, and +80 m height was reached in 17.50–26.01 s. The exact PR head passed three Actions workflows and merged as [`8a8a127`](https://github.com/dasol1819/project-apex/commit/8a8a12711e164b79997362a243caa3d742f5b5fa). [Pages run 42969491433](https://github.com/dasol1819/project-apex/actions/runs/42969491433) succeeded. Its 343,744-byte WASM checksum matched production over HTTP: `b9c76d6f98d8d929a2d935a4d7089982055a4bcf68c5d735561e7c01899ba715`. The tail rig preserves those native bytes. Production HTTPS returned HTTP 503 from this environment. Airbrakes, taxi clearance, full damage integration, remaining exterior residuals and hardware performance keep the aircraft in progress.

## Four native airbrakes and closed-pose repair · 2026-11-11

The source GLB has four distinct airbrake skins: port/starboard upper `OBJ0037`/`OBJ0057` and lower `OBJ0040`/`OBJ0060`. The upper skins were authored ajar while the native brake was off. Eight and seven unique exterior UV landmarks respectively match vertices on `mig23mld_fuz`. A rigid registration places each skin on its body opening without changing its vertices, UVs or textures. The source-to-body corrections are approximately 19.956° and 18.255°. They describe the authored asset pose, not real aircraft travel. [`airbrake-landmarks.csv`](airbrake-landmarks.csv), [`airbrake-fit.json`](airbrake-fit.json) and the C++17 [`fit-mig23-airbrakes.cpp`](../../../scripts/fit-mig23-airbrakes.cpp) retain the editable inputs and reproduce the transforms. The residual is approximately 3.3 micrometres RMS between floating-point model landmarks; it is not a physical fit tolerance.

The four skins now rotate from that closed pose with native state 22. The upper support centres and the lower authored pads define the pin lines. The source lower closed skins retain their original small clearance. [Actual game captures](15-four-airbrakes-in-game.jpg) show the normal AIR BRAKE button off, in transit, fully deployed, and returned to off, with both upper and lower cameras and a direct aft view. The [measured positions](15-airbrake-measurements.json) verify that the two upper tips rise about 0.390 m and the lower tips move outward about 0.491 m and downward 0.259 m. The original ribbed inner faces and fixed hinge supports remain visible. The test reduces throttle through the normal control before the close-ups to avoid afterburner glare.

The visual extension stop is 45°. An exact MLD maintenance/flight manual and matching open-panel photograph have not confirmed that limit, hydraulic fittings or full intermediate clearances. The current rig does not certify those details or add a physical airbrake damage model. [Keip's exact MLD aft view](https://www.arcair.com/awa01/101-200/awa189-MiG-23-Keip/45.shtm) and [starboard slab/root](https://www.arcair.com/awa01/101-200/awa189-MiG-23-Keip/47.shtm) were inspected for the closed exterior and adjacent fairing. The [new closed-pose overlay](16-airbrake-closed-photo-overlay.jpg) registers the actual current game render against the same exact MLD US Navy photograph at 48%, using the recorded single transform. That side view cannot independently establish an open airbrake angle or its internal actuator. The previously recorded fin, wing, intake, canopy and aft-profile residuals remain open.

The browser regression now also drives full pitch and yaw inputs with FBW off. [Closer maximum-command views](14-tail-native-stops.jpg) show the native slab outputs at approximately ±25° and the single rudder at approximately ±30°. The original moving skins remain articulated through these poses. Exact MLD shaft installation, hardware travel and all root-fairing clearances still require additional reference verification.

Reproduce the source fit and contact sheets with:

```sh
c++ -std=c++17 -O2 -Wall -Wextra -Wpedantic scripts/fit-mig23-airbrakes.cpp -o /tmp/fit-airbrakes
/tmp/fit-airbrakes docs/aircraft-review/mig23mld/airbrake-landmarks.csv
python3 scripts/review-mig23-airbrakes.py --captures /tmp/mig23-flight-browser --output docs/aircraft-review/mig23mld
```

The existing photo registration script and recipe also reproduce image 16 from the new browser captures and the original Navy photo (its generated `13-tail-photo-overlay.jpg` is saved separately as image 16). The original image 13 and earlier review evidence are preserved. Rendered model attribution remains Tim Samedov, CC BY 4.0; the Navy photograph is public domain.

Manifest/restore, the unchanged deterministic 343,744-byte native build, 17 regressions, C++ source-fit compilation/replay, and actual Chromium desktop/mobile checks passed locally. The runtime adds six transform nodes and 2,283 JavaScript bytes, with no new meshes or texture bytes. The dry side view retains 223 aircraft calls and 43,091 aircraft triangles. The original GLB and native WASM hashes match the tail checkpoint.

A separate actual-renderer [texture audit](texture-memory-audit.json) observed 36 visible texture objects backed by 22 uploaded WebGL texture handles. Dimensions were read from the loaded images; RGBA8 storage with full mipmaps is estimated at 183,074,056 bytes (174.6 MiB). Driver allocation and physical GPU FPS were not measured. Source sharing between multiple active aircraft is the next resource check; this audit covers one aircraft instance.

[Tail PR #26](https://github.com/dasol1819/project-apex/pull/26) passed all three exact-head Actions workflows and merged as [`b420722`](https://github.com/dasol1819/project-apex/commit/b420722950d3214d39f3719f6fb299e516a19b54). [Pages run 42972494716](https://github.com/dasol1819/project-apex/actions/runs/42972494716) succeeded. Production HTTP index HTML, model JavaScript and WASM matched the validated files byte for byte. HTTPS verification remains blocked by HTTP 503 from this environment. The complete aircraft remains in progress.

## Shared full-resolution source and independent instances · 2026-11-11

A real flight-renderer audit with two visual factory instances reproduced duplicate source loading. Each constructor decoded its own original GLB and images. The second instance added a source request and another 22 texture handles. Removing it released its geometry resources but left its source texture uploads in the renderer. The [baseline data](17-resource-baseline.json) correspond to the airbrake implementation in main commit `948b57bc013ba42b18bb8e09a2aab85b899e278b`.

The gameplay module now retains one immutable decoded source promise for its session. Every aircraft receives a cloned transform graph, materials and vertex buffers. Texture objects and their original full-resolution image data are shared. Nozzle morph targets are built on each aircraft's own geometry. A failed source promise is cleared so a later constructor can retry. Cancelling one aircraft does not abort the shared download used by another. The shared package intentionally remains available until the module session ends; there is no claim that the first aircraft's texture budget is removed after switching types. Separate WebGL contexts, such as the inspector, can allocate their own copies.

| Actual renderer observation | Previous loading | Shared source |
| --- | ---: | ---: |
| One aircraft: source texture handles | 22 | 22 |
| Two aircraft: source texture handles | 44 | 22 |
| Two aircraft: visible texture objects | 72 | 36 |
| Extra source requests for the second instance | 1 | 0 |
| Two-aircraft RGBA8 full-mipmap estimate | 366,148,112 B | 183,074,056 B |
| Total renderer texture count after removing the second instance | 56 | 34 |
| One-aircraft renderer calls / triangles | 245 / 44,513 | 245 / 44,513 |
| Two-aircraft renderer calls / triangles | 468 / 87,604 | 468 / 87,604 |

The [before/after game captures](17-resource-comparison.jpg) and [shared-source measurements](18-resource-shared.json) retain the original exterior, camouflage and detail. The camera is a test-only inspection view inside the actual game renderer. Pixel identity is not claimed: lighting/background and frame timing vary between runs. The audit observes texture handles and dimensions. Its RGBA8 byte counts are estimates and exclude driver overhead, other renderer contexts, framebuffer attachments and actual hardware VRAM/FPS. The extra object is a visual gameplay-factory fixture; this is not an AI combat or flight certification.

The regression independently poses the two aircraft with different wing sweep, gear, tail, rudder and afterburner states. It verifies distinct materials and nozzle geometry, shared source texture maps, a wet/dry/half-open nozzle sequence, an unchanged primary pose while the sibling updates, and a correct remaining render after sibling disposal. The new [`tests/mig23-resource-browser.py`](../../../tests/mig23-resource-browser.py) records these observations and screenshots. It joins the existing native flight browser CI and its uploaded artifacts. Reproduce it on a restored build with `APEX_TEST_URL=http://127.0.0.1:8765 python3 tests/mig23-resource-browser.py`; use `APEX_EXPECT_SHARED_SOURCE=0` when auditing the earlier loader. [`scripts/review-mig23-resources.py`](../../../scripts/review-mig23-resources.py) composes the two capture directories.

Manifest/restore, unchanged deterministic 343,744-byte native rebuild, 17 regressions, actual Chromium 141 / SwiftShader full-control desktop/mobile smoke and the two-instance resource/pose/disposal audit passed locally without page errors. The change adds 1,225 source JavaScript bytes, zero mesh detail and zero texture bytes. Geometry buffers and materials remain independently mutable per instance, and the 22,593,404-byte original GLB and native WASM hashes remain unchanged. Material, UV, source license and editable review data are preserved.

[Airbrake PR #27](https://github.com/dasol1819/project-apex/pull/27) passed all three exact-head workflows, including the C++ source-fit replay, then merged as [`948b57b`](https://github.com/dasol1819/project-apex/commit/948b57bc013ba42b18bb8e09a2aab85b899e278b). [Pages run 42976173806](https://github.com/dasol1819/project-apex/actions/runs/42976173806) succeeded. HTTP HTML, aircraft JavaScript and WASM matched the validated build byte for byte. The HTTPS endpoint remains blocked by HTTP 503 from this environment.

The shared-source change does not resolve the remaining exact MLD exterior, actuator limits, root/taxi clearances or physical damage work. Keep the complete aircraft in progress and preserve the existing fleet review.

### Current-main reconciliation — 2026-11-12 Seoul

PR #28 now incorporates main `1569099` through queue lease `0e28a0d`, retaining the per-axis instructor/mixed input, user-selected AUTO sweep thresholds, hidden detached OBJ0277 panel and moving OBJ0100 detail, F/A-18 download and all licenses. Cache identifiers advance to `mig23mld-11`: main already referenced game module `v10`. The instructor prefix and sweep module `v2` remain intact.

[Current validation](20-current-validation.json) records 20 native/model/queue checks, C++ airbrake registration replay, manifest/restore, a repeated deterministic 344,183-byte native build, actual desktop/mobile native flight, mixed-input controls and both resource baselines. No page errors. The native size/hash differs from the historical Nov 11 figures above because current main added the instructor extension; this PR does not change native simulation code or the tracked base binary. The original GLB hash is unchanged.

[Current baseline](20-current-baseline.json), [shared-source data](20-current-shared.json) and [actual game comparison](20-current-resource-comparison.jpg) reproduce 44→22 shared source handles, 72→36 texture objects and 1→0 extra GLB requests. Both versions submit 244/466 scene calls and 44,497/87,572 triangles for one/two aircraft after the inherited detached-panel fix. RGBA8 mip storage estimate remains 366,148,112→183,074,056 bytes; hardware VRAM and FPS remain unmeasured. Independent poses/nozzle geometry/materials and sibling disposal pass.

[New tail overlap](19-current-tail-photo-overlay.jpg) registers the current actual game render at 48% over the unblended public-domain US Navy photo crop preserved in image 13. The original image download returned HTTP 403 today. The [editable script](../../../scripts/review-mig23-tail-crop.py) uses the same whole-aircraft two-landmark transform and recorded crop; no part-specific warp. JPEG reproduction and camera/pose differences limit this comparison. Visual inspection still shows residuals at the vertical fin top/root and stabilator outline, so these are not certified shape errors in metres and the whole aircraft remains in progress. Closed airbrake fit and pitch/rudder extremes were re-rendered; exact physical stops and root/taxi clearance remain unverified. The single nozzle and controlled plume pass runtime states, but uncovered exact-MLD intake, rear nozzle and active plume photo matches remain pending. Wings need matched overhead evidence; gear timing/suspension and physical wreckage remain open.

[Part-by-part inspection](21-part-review.md) records intake, wing/root, tail, gear, nozzle/plume and damage limitations plus the recovered exact-MLD Keip detail references (linked, not redistributed). Reconciliation CI run [43056395728](https://github.com/dasol1819/project-apex/actions/runs/43056395728) passed native/C++/model checks but failed before browser launch when optional font packages could not resolve the Ubuntu mirror. The four Ubuntu-24.04 browser workflows now install the same pinned Playwright 1.56.0 headless Chromium shell without invoking apt. Native libraries were already installed on that runner; real browser launch and all test assertions remain mandatory. This failed run does not count as a renderer pass; wait for the replacement exact-head workflows.

### Published source-sharing checkpoint

Final head [`d36d529`](https://github.com/dasol1819/project-apex/commit/d36d529041a6910b3e954ef05d5e69652fd23df6) passed all four exact-head workflows: [preview](https://github.com/dasol1819/project-apex/actions/runs/43058442457), [tree](https://github.com/dasol1819/project-apex/actions/runs/43058442405), [mixed controls](https://github.com/dasol1819/project-apex/actions/runs/43058442449), and [native flight/weapons/resources](https://github.com/dasol1819/project-apex/actions/runs/43058442618). The replacement native CI reproduced the local resource counts and independent nozzle/pose/disposal results. Additional local studio, tree (three layouts), and missile browser tests passed; the proximity burst visual was 0.04 m from the native event point with WebGL error 0 in the test fixture.

[PR #28](https://github.com/dasol1819/project-apex/pull/28) merged as [`dc58088`](https://github.com/dasol1819/project-apex/commit/dc580884af01f200f4852a30204aef84b6527d98). [Pages 43059931057](https://github.com/dasol1819/project-apex/actions/runs/43059931057) succeeded. [Publication verification](22-deployment-verification.json) records nine production HTTP files byte-matching the validated build, including current native WASM and the original source GLB. The HTTPS endpoint still returns 503 with an upstream connection failure before app files arrive; HTTPS publication is not verified. The canonical GitHub Pages URL currently redirects to the custom domain over HTTP.

The [part review](21-part-review.md), registered photo crop, editable recipes, measurements and existing 15-aircraft review are preserved. Continue MiG-23MLD rather than selecting a new variant. No aircraft status is promoted by this resource-only fix.
