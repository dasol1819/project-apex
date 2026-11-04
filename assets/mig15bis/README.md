# MiG-15bis SD — native aircraft 15

This is an original, editable reconstruction authored for Project Apex, not manufacturer CAD and not an alias of an existing fighter. Geometry stations, wing sections, hardware, original Soviet-style red-star paint and finite panel/roughness/normal/AO masks are in `web/mig15bis-model.js` and `web/mig15bis-finish.js`. Existing Three.js helpers provide loft/airfoil tessellation, damage overlays and batching. No War Thunder or DCS geometry or textures are used.

The livery is an original Soviet-style finish with red number 23. Reference aircraft wear different national markings; no claim is made to reproduce their identity. The configured clean air-combat fit has no external tanks, bombs or missile launchers. VK-1 is a non-afterburning engine with a fixed-area tailpipe. It has no TVC, combat radar or countermeasures. Two NR-23 (80 rounds each) and one N-37D (40 rounds) use native projectiles, gravity, drag and damage. The common trigger uses a synchronized aggregate 35-round/s cadence with four 23mm rounds then one 37mm round; individual gun timing is approximated. Per-projectile 37mm impact class is retained through flight and target impact. Aerodynamic derivatives, inertia, RCS and damage multipliers are game estimates.

## Public references (accessed 2026-11-04)

- National Museum of the USAF, exact MiG-15bis: dimensions, VK-1 dry thrust, cannon fit and exterior photographs: https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/196115/mikoyan-gurevich-mig-15bis/
- National Naval Aviation Museum, MiG-15: https://www.history.navy.mil/content/history/museums/nnam/explore/collections/aircraft/m/mig-15.html
- Planes of Fame, Soviet-built 1951 MiG-15bis (NX87CN): https://www.planesoffame.org/aircraft/plane-MiG-15-flyer
- RAF Museum, MiG-15bis / licensed Lim-2 reference: https://www.rafmuseum.org.uk/research/collections/mikoyan-gurevich-mig-15bis/

Museum dimensions differ slightly by exhibit and measurement convention. The reconstruction uses span 10.085 m, nose-to-tail approximately 10.10 m, and overall height on its contact plane 3.70 m. Small gun protrusions/lights extend those bounds. Wing area 20.6 m² and nominal 26.48 kN thrust inform the native model; the public museum speed is a reference, not a measured in-game claim.

## Reference photo licenses

These photographs are reference/comparison evidence, not game textures. Their authors do not endorse the model.

| Local file | Photographer / source | License |
| --- | --- | --- |
| `references/monino-front.jpg` | Kirill Pisman, 2008-10-15, https://commons.wikimedia.org/wiki/File:MiG-15bis.jpg ; original https://www.flickr.com/photos/kpisman/2943206639/ | CC BY-SA 2.0, https://creativecommons.org/licenses/by-sa/2.0/ |
| `references/usaf-rear.jpg` | Valder137, 2009-09-26, https://commons.wikimedia.org/wiki/File:Mikoyan-Gurevich_MiG-15bis_Fagot_LRearSide_Modern_Flight_NMUSAF_26Sep09_(14600299005).jpg | CC BY 2.0, https://creativecommons.org/licenses/by/2.0/ |
| `references/usaf-side.jpg` | Valder137, 2009-09-26, https://commons.wikimedia.org/wiki/File:Mikoyan-Gurevich_MiG-15bis_Fagot_LSide_Modern_Flight_NMUSAF_26Sep09_(14577282046).jpg | CC BY 2.0, https://creativecommons.org/licenses/by/2.0/ |

Comparison derivatives retain these attributions and the applicable license. Original photos remain unchanged. Overlays add the rendered game reconstruction and outlines; registration adjusts only camera position, orientation and focal length, not the aircraft mesh or the photograph.

## Build and verify

```
python3 scripts/update-web-manifest.py
python3 .deployment/restore.py
node scripts/native/export-mig15-shapes.mjs public
npm run build:combat
python3 scripts/update-web-manifest.py
python3 .deployment/restore.py
node tests/mig15-native.mjs public
node tests/mig15-model.mjs public
node scripts/mig15bis/export-review.mjs public .native-build/mig15-review 15
REVIEW_DATA=.native-build/mig15-review REVIEW_OUTPUT=docs/reviews/mig15bis python3 scripts/mig15bis/render-review.py 15
```

The EGL exporter/renderer is adapted from this repository's existing fleet review helpers at commit `7eaffc3606798cea3870423efa0933a938899d4c`. Its OpenGL shaders expand the same Three.js shader chunks and material hooks used in the game. This is an offscreen shader/visual check, not a WebGL browser gameplay or hardware FPS measurement. Browser QA was attempted and the environment reported `Error creating WebGL context.`
