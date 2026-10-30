# Flanker exterior source and adaptation

Original geometry and textures: FlightGear / FGUK Su-27, credited by the upstream aircraft definition to **Lee Elliott, StuartC and VooDoo**.

Source: https://github.com/FGMEMBERS/SU-27
Pinned revision: `a9c4863886a5835dfa4406698dd4557fbf72a3aa`
License: GNU GPL version 2; see `COPYING`.

`original.ac`, `albedo.png`, `glass.png` and `seat.png` are the unmodified upstream model and its associated textures, renamed here for clarity. The Project Apex adaptation is rebuilt by `scripts/su35/build_asset.py`. It adjusts the exterior to a Su-35S game reconstruction: corrected dimensions, offset IRST, wingtip equipment and separate vectoring exhausts. These derived model assets and their adaptation script are provided under GPL-2.0 together with this source. They are not manufacturer CAD and do not provide Su-35 flight physics.

The source model is a starting point for the reconstruction, not evidence that a Su-27 and Su-35 are the same aircraft.

The browser reconstruction adds the modern cockpit, rounded seat and harness, projected markings and moving exhaust cassette in `web/su35-model.js`, `web/su35-cockpit.js`, `web/su35-markings.js` and `web/su35-details.js`. The Blender file contains the refined source shell; these browser additions remain editable JavaScript geometry. The downloadable archive includes both forms and their readable module dependencies.

To rebuild an extracted source archive, run `blender -b --factory-startup --threads 4 --python scripts/su35/build_asset.py -- --bake` from its root. This writes geometry, textures, license and occlusion to `web/assets/su35`. Repackage with `python3 scripts/su35/package_source.py web` and serve the `web` directory to inspect `su35.html`.
