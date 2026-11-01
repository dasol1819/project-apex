# MiG-29 9.12 native game integration

The initial Fulcrum-A has its own native aircraft ID **14**. Geometry, player/AI selection, weapons, radar and damage all use that identity. It is not an alias for another aircraft.

## Model and flight

The adapted GPL source and credits are in `../mig29-source/`. Geometry is refined in Blender with crease-preserving subdivision and a shared 2048-pixel AO atlas. Overall dimensions are 17.32 m length, 11.36 m span, approximately 4.73 m height in the extended gear pose. The model includes the complete lower skin, split aft airbrake, hinged FOD doors and auxiliary louvers, independent leading edges/flaps/ailerons/tails/rudders, retractable gear, analog instruments and a HUD below the windshield. The grey/green livery is authored for the game, not a claim of an exact individual service aircraft.

The native aircraft table uses 10,900 kg empty mass, 3,500 kg internal fuel capacity, 38 m² reference wing area, 18,480 kg MTOW, +9/-3 G and a 26° commanded alpha limit. Two RD-33 engines use 49.42 kN dry and 81.4 kN afterburning per engine. The nozzles change area but do not vector. Inertias and aerodynamic derivatives are explicit game estimates; they are not manufacturer data. Separate flaps deploy to 25° through the native damage-aware actuator, while common flaperon and differential airbrake rudder mixing is disabled for this type. Stores add native mass and estimated drag, and fuel, altitude, airspeed and damage remain part of the existing flight solver.

## Combat

Three profiles use IDs 42–44: four R-73 plus two R-27R, four R-73, and clean/150-round GSh-30-1. All six stations have native CG-relative launch coordinates and fitted visible pylons. Store visibility follows native ammunition and supporting structure damage. The R-73 uses the game's dedicated short-range Russian motion profile. R-27R uses the existing semi-active homing solver: launch requires STT and radar illumination must continue after launch. Missile acceleration, seeker and turn limits are game estimates.

N019 is represented as pulse Doppler with STT, a 90 km game reference range against the game's reference RCS, no TWS and no surface-target mode. These sensor values, RCS and weapon parameters do not reproduce classified performance. The existing countermeasure programs, AI, 20-second empty-category reload and respawn rules are retained. Gun muzzle velocity and delivered hit energy follow the existing 30 mm treatment.

Thirty collision regions are generated from the visible model. Native probes match the three gear contacts. The original 14 implemented aircraft retain their table rows and bit-identical trajectories; the original encoded deployment payload stays unchanged.

## Build and checks

After restoring the runtime:

```
npm ci
npm run build:combat
node tests/mig29-native.mjs /workspace/apex-runtime/public
node tests/mig29-combat.mjs /workspace/apex-runtime/public
node tests/mig29-model.mjs /workspace/apex-runtime/public
python3 tests/mig29-browser.py
```

The native builder first reproduces the checksum-pinned Su-35 module, saves that baseline, then appends the MiG tables and narrowly bounded control/weapon branches. Unsupported layouts fail structural assertions. CI verifies the committed WASM against a rebuild, all legacy/Su-35 tests, and the MiG tests.

Tests cover all 14 previous aircraft over 16,800 legacy ticks, 12 flight-envelope cases, loadout masses, conventional controls/no TVC, native gun/IR/RF impacts, AI combat, STT loss, all four IR stations, countermeasures, reload and takeoff; geometry tests cover dimensions, 18 open inlet rays, six underside rays, HUD clearance, mechanisms, stations and damage inheritance. Desktop/mobile browser checks exercise real main-game tree selection, all three profiles, a three-MiG fleet and throttle input.
