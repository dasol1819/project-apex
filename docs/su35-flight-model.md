# Su-35S independent flight test

The exterior studio links to `su35-flight.html`. It uses the same licensed airframe and an independent JavaScript rigid-body model. The existing combat WASM module does not expose a way to add Su-35 coefficients, and its source is absent from this export. The new test therefore has its own dynamics rather than relabelling another aircraft's flight model.

| Input | Value | Basis |
| --- | --- | --- |
| Empty mass | 19,000 kg | Public Su-35 specification |
| Maximum takeoff mass | 34,500 kg | Public Su-35 specification |
| Internal fuel capacity | 11,500 kg | Public Su-35 specification |
| Wing area / span | 62 m² / 15.3 m | Public Su-35 specification |
| Dry / maximum static thrust | 172.8 / 284.4 kN total | Two AL-41F1S engines |
| Positive / negative load command | +9 / −3 G | Game flight controller envelope |
| Nozzle pitch travel | ±15° | Public TVC travel reference |
| Pitch / yaw / roll inertia | 180,000 / 270,000 / 40,000 kg·m² at 25 t | Explicit estimates |
| Aerodynamic derivatives, stall curve, CG, thrust lapse, response rates | See module | Explicit game estimates |

Reference: [UAC Su-35](https://uacrussia.ru/en/aircraft/lineup/military/su-35/). The table is not a manufacturer aerodynamic data package or a claim of certified performance.

`su35-flight-physics.js` evaluates ISA density and sound speed through the troposphere and lower stratosphere. Lift depends on dynamic pressure and angle of attack. Induced drag uses aspect ratio and an estimated span efficiency; the polar includes gear, speedbrake, sideslip, high-angle and transonic terms. Beyond the attached-flow range the lift curve transitions to a flat-plate approximation. Thrust changes with altitude, airspeed and engine spool. Fuel consumption changes mass, and gear deployment takes four seconds.

The controller commands normal load and angle of attack, damps pitch/yaw rates and limits roll rate. It accounts for the thrust component normal to the flight path while trimming lift. Dynamic-pressure and Mach protection reduce commanded engine power progressively. TVC force acts behind the estimated CG, so an upward exhaust direction creates a downward reaction at the tail and a nose-up moment. Translation includes gravity; attitude uses body angular momentum and a normalized quaternion, integrated with 1/120 s substeps. The rendered tailplanes, flaperons, rudders, gear and nozzles follow those control states.

The test starts airborne at 1,500 m, 210 m/s, 6,000 kg fuel and no external payload. It provides keyboard and touch controls, throttle, gear, TVC, braking, pause and reset. It has a simple reference environment and ground-contact termination; combat weapons, radar, takeoff, landing-roll and manufacturer post-stall validation are outside this prototype.

Validation: `node tests/su35-flight-physics.mjs public` checks ISA values, thrust, dynamic-pressure scaling, stall/drag behavior, mass bounds, engine and gear response, TVC reaction, control direction, trim and equivalent trajectories at 30/120 Hz, including speed protection. `tests/su35-flight-browser.py` exercises actual desktop keys and mobile touch input, pause/reset and camera following.
