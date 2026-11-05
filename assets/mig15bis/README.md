# MiG-15bis SD — native aircraft 15

This is an original, editable reconstruction authored for Project Apex, not manufacturer CAD and not an alias of an existing fighter. Geometry stations, wing sections, hardware, original Soviet-style red-star paint and finite panel/roughness/normal/AO masks are in `web/mig15bis-model.js` and `web/mig15bis-finish.js`. Existing Three.js helpers provide loft/airfoil tessellation, damage overlays and batching. No War Thunder or DCS geometry or textures are used.

The livery is an original Soviet-style finish with red number 23. Reference aircraft wear different national markings; no claim is made to reproduce their identity. The configured clean air-combat fit has no external tanks, bombs or missile launchers. VK-1 is a non-afterburning engine with a fixed-area tailpipe. It has no TVC, combat radar or countermeasures. Two NR-23 (80 rounds each) and one N-37D (40 rounds) use native projectiles, gravity, drag and damage. The common trigger uses a synchronized aggregate 35-round/s cadence with four 23mm rounds then one 37mm round; individual gun timing is approximated. Per-projectile 37mm impact class is retained through flight and target impact. Aerodynamic derivatives, inertia, RCS and damage multipliers are game estimates.

## Public references (accessed 2026-11-04)

- National Museum of the USAF, exact MiG-15bis: dimensions, VK-1 dry thrust, cannon fit and exterior photographs: https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/196115/mikoyan-gurevich-mig-15bis/
- National Naval Aviation Museum, MiG-15: https://www.history.navy.mil/content/history/museums/nnam/explore/collections/aircraft/m/mig-15.html
- Planes of Fame, Soviet-built 1951 MiG-15bis (NX87CN): https://www.planesoffame.org/aircraft/plane-MiG-15-flyer
- RAF Museum, MiG-15bis / licensed Lim-2 reference: https://www.rafmuseum.org.uk/research/collections/mikoyan-gurevich-mig-15bis/

Museum dimensions differ slightly by exhibit and measurement convention. The reconstruction uses span 10.085 m, overall nose-to-tail/fin approximately 10.10 m (the fuselage itself is approximately 8.13 m), and overall height on its contact plane 3.70 m. Small gun protrusions/lights extend those bounds. Wing area 20.6 m² and nominal 26.48 kN thrust inform the native model; the public museum speed is a reference, not a measured in-game claim.

## Reference photo licenses

These photographs are reference/comparison evidence, not game textures. Their authors do not endorse the model.

| Local file | Photographer / source | License |
| --- | --- | --- |
| `references/monino-front.jpg` | Kirill Pisman, 2008-10-15, https://commons.wikimedia.org/wiki/File:MiG-15bis.jpg ; original https://www.flickr.com/photos/kpisman/2943206639/ | CC BY-SA 2.0, https://creativecommons.org/licenses/by-sa/2.0/ |
| `references/usaf-rear.jpg` | Valder137, 2009-09-26, https://commons.wikimedia.org/wiki/File:Mikoyan-Gurevich_MiG-15bis_Fagot_LRearSide_Modern_Flight_NMUSAF_26Sep09_(14600299005).jpg | CC BY 2.0, https://creativecommons.org/licenses/by/2.0/ |
| `references/usaf-side.jpg` | Valder137, 2009-09-26, https://commons.wikimedia.org/wiki/File:Mikoyan-Gurevich_MiG-15bis_Fagot_LSide_Modern_Flight_NMUSAF_26Sep09_(14577282046).jpg | CC BY 2.0, https://creativecommons.org/licenses/by/2.0/ |

Comparison derivatives retain these attributions and the applicable license. Original photos remain unchanged. Overlays add the rendered game reconstruction and outlines; registration adjusts only camera position, orientation and focal length, not the aircraft mesh or the photograph.

Additional outline references: Arz, own three-view line drawing, 2006-11-30 (public domain), https://commons.wikimedia.org/wiki/File:Mikoyan-Gurevich_MiG-15_3-view_line_drawing.png ; Greg Goebel, exact bis silhouette (public domain), https://commons.wikimedia.org/wiki/File:Mikoyan-Gurevich_MiG-15bis_three-view_silhouette.png . The first drawing is a general MiG-15 outline, cross-checked against the exact bis photographs rather than used as variant identification. Local files `references/arz-three-view.png` and `references/goebel-bis-silhouette.png` preserve these references.

Photo overlays exposed an overlong fuselage and insufficiently swept/too-forward fin. The reconstruction was corrected to distinguish fuselage length from the overall fin extremity, with a fin leading edge close to 55 degrees. The photographs show an open/sliding canopy; registration therefore uses the open-canopy state. Original and corrected overlays, raw hand-selected anchors, camera matrices and per-anchor pixel residuals are retained under `docs/reviews/mig15bis`. These residuals are not a certified geometric tolerance.

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

Complete validation: `python3 scripts/mig15bis/validate.py`. Mechanism/power/damage evidence: `python3 scripts/mig15bis/review-states.py`. Photo comparison: `python3 scripts/mig15bis/photo-overlay.py assets/mig15bis/rear-registration.json` and the corresponding `side-registration.json`. Dependencies for offline review are NumPy, SciPy, Pillow and ModernGL; they are not shipped to the game.

## 2026-11-05 control and wing correction

USAF ATIC TR-AE-63, *MIG-15 (VK-1) Pilot's Operating Manual*, 26 April 1955, section I (printed page 1), accessed 2026-11-05: https://www.governmentattic.org/14docs/MIG-15pilotOpManual_1955.pdf . The official declassified report was released by NASIC under FOIA in 2015 and explicitly describes the VK-1 version. It gives approximately two degrees of anhedral. The authored wing previously used about 0.97 degrees; geometry, lights and pitot now follow two degrees.

The flap/aileron axes now follow their actual swept mesh cut. A new geometry-derived regression measures both ends of the cut edge during positive and negative deflection; the previous maximum separation was 0.2333 m. Paint crossing the aileron is clipped to the control boundary and assigned to the moving control. See `docs/reviews/mig15bis/hinge-correction/review.json`, its comparison and `tests/mig15-hinges.mjs`. Exact-variant photo overlays were regenerated with updated wingtip landmarks. These limited corrections do not complete the remaining camera/shape review.
