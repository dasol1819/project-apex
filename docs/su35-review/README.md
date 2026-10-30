# Su-35S exterior reconstruction review

The previous procedural skin had the wrong relationship between the front fuselage, cockpit, engine spacing and landing gear. The replacement uses a pinned, UV-mapped GPL Flanker exterior, adapted for the Su-35S visual study. It adds separate TVC nozzles, offset IRST, wingtip fairings, projected insignia and a new instrument panel and seat. This remains an exterior preview; there is no native Su-35 simulation ID.

The work session began at **2026-10-29 23:24:04 UTC**. The final geometry and close-up review continued through **2026-10-30 00:24:05 UTC**, exceeding one hour before publication. The source, build pipeline and rendered views were repeatedly revised during the session. Iterations included:

1. Compare the procedural model with front, side, rear and cockpit photographs. Correct engine spacing, inlet and cockpit positions, gear placement and the Flanker planform using the licensed source.
2. Preserve AC3D corner UVs and smooth normals, refine the skin in Blender, remove old intake caps and fixed exhaust exits. Rebase the original negative V tile before baking occlusion.
3. Inspect all seven rendered views. Correct wing markings that missed the surface, replace the overly polished exhaust finish, adjust front/cockpit cameras and add two MFDs, HUD and side consoles.
4. Inspect the cockpit with its canopy open. Replace the low-resolution seat with rounded cushions, frame, belts, buckles and an ejection handle. Add morph normals so nozzle lighting follows its changing aperture. Compare the exhaust photograph again and add the rigid forward cassette and two retaining bands.
5. Find the HUD protruding above the fixed windshield in the final close-up. Measure the glass surface and lower the combiner and supports, then add a physical clearance check.
6. Exercise actual browser controls and tree navigation, inspect maximum ramp/aperture/vector states, and verify the restored files match the checksummed overlay.

## Rendered review

The images show the browser renderer with the actual geometry, textures and baked occlusion, without an image enhancement pass.

[Overview](overview.png) · [Front](front.png) · [Planform](planform.png) · [Intake](intake.png) · [Exhaust](nozzle.png) · [Open cockpit](cockpit.png)

## Validation

- Visible dimensions: 15.3 × 5.9 × 21.9 metres; 177,778 visible triangles in the geometry check.
- Eighteen inlet rays; the central sightlines reach the compressor approximately four metres behind each mouth.
- Canopy lift, physical nozzle aperture and exhaust frame movement under vectoring; HUD clearance inside the fixed windshield; malformed geometry downloads are rejected.
- All thirteen existing aircraft still instantiate, including both fins on the relevant models.
- Chromium via Playwright: seven views, five mechanisms, keyboard and pointer controls, PNG download, a 390px mobile viewport, and the real aircraft-tree entry. No page or shader errors in the completed run. Mobile validation uses emulation.
- Original source hashes, editable Blender texture paths, source archive integrity, independent geometry reconstruction from that archive, gzip round-trip and all twenty restored overlay files verified.

Run `node tests/su35-geometry.mjs /path/to/restored/public` and `APEX_TEST_URL=http://127.0.0.1:8000 python3 tests/su35-browser.py`. See the root README for restoration and Blender conversion.

## Source and reference

Original geometry and textures: Lee Elliott, StuartC, VooDoo / FGUK FlightGear Su-27, GPL-2.0. Pinned revision and corresponding source are in [assets/su35-source](../../assets/su35-source). The studio provides a downloadable source archive.

Public photographs and dimensions were compared against [Wikimedia Su-35 material](https://en.wikipedia.org/wiki/Sukhoi_Su-35) and [UAC](https://uacrussia.ru/en/aircraft/lineup/military/su-35/). Internal duct layout, cockpit equipment and motion ranges are visual approximations. The source still carries inherited Flanker surface artwork; this is a game reconstruction, not manufacturer CAD or a reproduction of one particular airframe.
