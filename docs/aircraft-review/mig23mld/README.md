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
