# MiG-29 9.12 source and adaptation

Pinned upstream: https://github.com/FGMEMBERS/MiG-29 at `646e9f9d6b958773e69cbde74602642c91fcfcaf`.
Original model credits: Detlef Faber and Gary R. Neely. GPL-2.0; see COPYING.txt and UPSTREAM-README.txt.

The AC3D airframe and cockpit, RGB atlas, public simulator FDM and animation reference are retained without replacing the original game payload. `scripts/mig29/build_asset.py` refines the source with crease-preserving subdivision, retains the extrema, rescales to the published 17.32 m length and 11.36 m span, exports editable Blender and web buffers, and bakes ambient occlusion. Run with Blender 4.3:

```
blender -b --factory-startup --threads 4 --python scripts/mig29/build_asset.py -- --bake
```

The web model adds an authored grey/green game livery, analog cockpit, independent controls, intake ducts, compressor faces, FOD doors, fixed-axis variable-area nozzles and missile stations. It represents the original narrow-spine 9.12; it does not claim SMT or TVC equipment. This is a game reconstruction using public information, not production CAD. Aerodynamic derivatives, inertias, radar/RCS and weapon parameters are estimates.

The native game integration uses aircraft ID 14 with separate mass, thrust, aerodynamic and sensor tables. It retains the original game’s systems and damage model.

The close-up graphics revision refines the fuselage and glazing at subdivision level 3,
bakes the shared 2048² AO atlas, separates the pinned source's inward-facing inlet
walls, and replaces its ground-only wedge plugs with fitted hinged FOD ramps.
`web/mig29-details.js` contains editable bevel geometry for the cockpit, flat seat
webbing, console controls, projected markings, and continuous RD-33 exhaust liners
with overlapping morphing feathers. `web/mig29-finish.js` defines neutral-coordinate
camouflage, antialiased panel/fastener detail, small surface relief, roughness variation
and heat-tinted metal. Nose number 24 and the paint are authored game markings.
The full model stays below a 245,000 visible-triangle budget. Collision regions are
exported again from the new neutral geometry before rebuilding the native module.


The packed PBR revision adds an independent, non-overlapping UV channel for
surface relief and occlusion. Original positions, normals and paint UVs remain
byte-identical. Run `BASISU=/path/to/basisu python3 scripts/mig29/build_surface.py`:
the Blender chart/AO pass feeds the shared rasterizer and KTX2 encoder. See
[the surface review](../../docs/mig29-surface-review/README.md) for captures,
resource costs, tests and reproduction details. No War Thunder assets are used.
