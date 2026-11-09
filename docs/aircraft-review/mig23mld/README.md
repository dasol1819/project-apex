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
