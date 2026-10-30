# Su-35S native combat integration

The main game uses aircraft ID **13** for the Su-35S. It is a native aircraft definition, with the existing combat solver, fleet bridge, AI, weapons, damage and respawn. The independent JavaScript flight laboratory is a separate optional page.

## Public geometry and engine references

- [UAC Su-35](https://uacrussia.ru/en/aircraft/lineup/military/su-35/) and [Rosoboronexport Su-35](https://roe.ru/en/production/multipurpose-fighters-and-fighter-bombers/su-35/): public configuration and overall dimensions.
- The credited FGUK/FGMEMBERS Su-27 source, adapted to Su-35S, remains in `../su35-source/` under GPL-2.0. The source pins and reconstruction limitations are documented there.
- Overall game dimensions: 21.9 m length, 15.3 m span, 62 m² reference wing area. Empty mass 19,000 kg; internal fuel limit 11,500 kg; maximum takeoff mass 34,500 kg.
- Two AL-41F1S engines: 86.4 kN dry / 142.2 kN afterburning per engine. Native table thrust fields use lbf; the UI also reports kN.
- The native vectoring actuators stop at ±15°, with 32° canted axes. Engine and actuator health, response rates and reaction moments remain inside the native simulation.

Aerodynamic derivatives, inertia, RCS, sensor range/quality, weapon motion parameters and T220/E compatibility/mass are **game estimates**. These are not manufacturer aerodynamic tables, a certification of a real weapon combination or a reproduction of classified avionics. N035 Irbis is represented as PESA/TWS; it is not relabelled N036 AESA.

## Integrated behavior

The main tree, hangar, player and AI selectors share the same ID. Four loadouts use native profile IDs 38–41. Counterair carries two R-73 and six R-77-1; precision carries two KAB-250LG-E, two R-73, four R-77-1 and a T220/E game pod; clean and patrol configurations are separate. Bomb stations do not overlap the precision loadout's missile stations.

Missile and bomb launch positions, visible pylons and the model share CG-relative coordinates. R-77-1 uses lattice control fins, while the existing Su-57 keeps its R-77M model. Weapons have native guidance, impact and ammunition states. Store mass and estimated parasitic drag change with the remaining load. Empty launch rails remain visible. The GSh-30-1 has 150 rounds, 30 rounds/s and the native 30 mm muzzle velocity/impact treatment. The existing game's 20-second empty-inventory reload rule also applies.

Thirty damage regions are exported from the visible neutral model. Hull partitioning preserves every original triangle; gear probes match the three ground contacts. Wing, engine, intake, nozzle, fin and control damage affect the native simulation and visible model together. Attached stores follow the supporting structure. Fractured meshes retain UVs and frozen camouflage coordinates. Respawn restores structure and ammunition while preserving the selected profile under the game's respawn rules.

The cockpit receives live attitude, altitude, speed, G, angle of attack, fuel, radar state and missile inventory. Plumes follow each physical vectoring nozzle. Gear, leading edges, flaperons, tails and rudders use native actuator states; the Su-35's rudders also flare for airbraking.

## Reproducible native extension

`config.json` defines the appended airframe, radar, RCS and loadout rows. `shapes.json` is generated from the combat model with `node scripts/native/export-su35-shapes.mjs public` after restoring the public directory. Stores and effects are excluded from the collision bounds.

`npm ci && npm run build:combat` extracts and verifies the original `flight.wasm` (SHA-256 `51522ef91770b10155634793b49bcb92772507ef3b3bfedd53c889068385aa36`), uses WABT to read its named instruction representation, appends tables in a new memory page and builds `web/flight.wasm`. Existing definition rows and addresses remain intact. New type guards, profile capability masks, station coordinates and dedicated native branches are explicit in the build script. An unsupported original module fails the checksum or structural assertions instead of applying a speculative patch.

The original `.deployment/web-*.b64` payload is unchanged. `web/manifest.json` verifies all overrides. CI rebuilds the module and checks it against the committed binary before publication.

## Verification

- `su35-combat-native.mjs`: original 13-aircraft specs/radars/gear/loadouts and bit-identical trajectories over 15,600 ticks; Su-35 identity, four loadout masses, 12 flight-envelope scenarios, nozzle stops, damage and reset.
- `su35-combat-systems.mjs`: fleet-based RF/IR acquisition, launch, trajectories and hits; Su-35 as an RF target; 150 gun rounds and reload; laser pod; native bomb release; flare/chaff; runway takeoff.
- `su35-combat-model.mjs`: 30 collision bounds, exact preservation of source triangles, launch/station alignment, structure/store visibility and clipped wreckage attributes.
- Existing geometry and independent FDM tests remain. Playwright covers desktop/mobile selection, four loadouts, three Su-35S actors, throttle input and page/shader errors in the actual main game.
