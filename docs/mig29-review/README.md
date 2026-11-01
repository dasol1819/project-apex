# MiG-29 close-up graphics revision

These are unretouched Chromium captures of the model used by the main game and
in-game inspector. They show the authored grey/green game paint, not a claimed
replica of a particular numbered operational aircraft.

- [Overall airframe](overview.png): level-3 fuselage/glazing refinement, rebaked
  2048² occlusion, frozen-coordinate panel and fastener detail, projected markings.
- [Intake](intake.png): separately finished original inward-facing walls, a fitted
  hinged FOD ramp, rounded lip, continuous passage and recessed compressor.
- [RD-33 exhaust](nozzle.png): continuous heat shield and inner passage, recessed
  flame holder, overlapping curved feathers with position/normal morphs,
  attachment hardware and heat-tinted metal.
- [Cockpit](cockpit.png): beveled seat and panel, flat webbing and buckles,
  emergency handles, console toggles, dial glass and less opaque canopy glazing.

The neutral model has 238,896 visible triangles, below the 245,000 budget. Visible
span/height/length are 11.360 / 4.721 / 17.320 m. Geometry tests cover six underside
rays, eighteen open-inlet rays, closed-door obstruction, the full FOD sweep,
both physical nozzle apertures, windshield clearance, stores, thirty matching
collision regions, and wreckage attributes. The native module is rebuilt from
those collision regions. The fourteen existing aircraft remain bit-identical
across 16,800 regression ticks.

Reproduce with the Blender pipeline in [the source README](../../assets/mig29-source/README.md),
`tests/mig29-model.mjs`, `tests/mig29-graphics-browser.py`, and `tests/mig29-browser.py`.
Browser validation uses SwiftShader and does not establish a hardware frame rate.
Original mesh: Detlef Faber and Gary R. Neely / FGMEMBERS MiG-29, GPL-2.0-only.
