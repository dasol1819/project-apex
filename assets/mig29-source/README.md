# MiG-29 9.12 source and adaptation

Pinned upstream: https://github.com/FGMEMBERS/MiG-29 at `646e9f9d6b958773e69cbde74602642c91fcfcaf`.
Original model credits: Detlef Faber and Gary R. Neely. GPL-2.0; see COPYING.txt and UPSTREAM-README.txt.

The AC3D airframe and cockpit, RGB atlas, public simulator FDM and animation reference are retained without replacing the original game payload. `scripts/mig29/build_asset.py` refines the source with crease-preserving subdivision, retains the extrema, rescales to the published 17.32 m length and 11.36 m span, exports editable Blender and web buffers, and bakes ambient occlusion. Run with Blender 4.3:

```
blender -b --factory-startup --threads 4 --python scripts/mig29/build_asset.py -- --bake
```

The web model adds an authored grey/green game livery, analog cockpit, independent controls, intake ducts, compressor faces, FOD doors, fixed-axis variable-area nozzles and missile stations. It represents the original narrow-spine 9.12; it does not claim SMT or TVC equipment. This is a game reconstruction using public information, not production CAD. Aerodynamic derivatives, inertias, radar/RCS and weapon parameters are estimates.

Work in progress is checkpointed separately from the published Su-35S.
