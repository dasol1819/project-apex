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
