# Aircraft instructor and mixed-input controls

The existing native flight module already supplies direction tracking,
angular-rate feedback, an aircraft-dependent flight envelope, actuators and
damage. Previously, a keyboard/stick input on any axis selected the global
pilot override and reset the target every sample. All other direction
assistance disappeared even during a roll-only correction.

The new native API `set_pilot_axis_override(mask)` owns only the requested
axes (pitch 1, roll 2, yaw 4). The direction solver runs independently of
those raw manual commands. Immediately before native FBW, the owned axes
receive their exact proportional input; unowned axes retain the direction
solver's commands. Held-axis controller state is cleared to avoid windup.
Aircraft attitude, velocity, rates and surface deflections are never replaced
by JavaScript. Existing physical protection and actuator rates still apply.
The legacy global override is retained for fully direct input, FBW-off,
missions and old consumers. The mask defaults to zero and resets on native
aircraft/respawn/global-override changes. AI callers do not opt into it.

Mouse/touch drag controls a world-space direction, while stick input controls
axes. Mouse movement remains available during held-axis corrections. Screen
axes are taken from the current camera so banked and inverted cockpit input
does not reverse, and target directions can cross the zenith/nadir instead
of stopping at a world elevation of 85 degrees.

Default release behavior seeds the target once from the actual nose when
the last manual axis is released. A deliberate mouse target update during
the correction survives release. An optional setting retains the old target
instead. There is no automatic mode latch or imposed release delay.

Settings distinguish pointer sensitivity from analog stick dead zone,
nonlinearity and time response. Analog defaults are 8% dead zone, exponent
1.5, immediate response. Keyboard commands bypass analog filtering; opposite
buttons explicitly own their axis at neutral even while the direction
instructor is active. No live setting claims to reproduce an undisclosed
War Thunder gain, aircraft SAS law, crew statistic or mouse arbitration rule.

Public research used for design (accessed 2026-11-11):

- [Gaijin instructor overview](https://warthunder.com/en/news/4366-wiki-article-how-the-instructor-works-en)
- [Input-axis guide](https://wiki.warthunder.com/controls/4785-setting-up-control-axis-and-sensitivity)
- [Opposite button inputs, 2026-04-21](https://warthunder.com/en/game/changelog/current/1850)
- [Direction-control patent](https://patents.google.com/patent/US8770979B2/en)

This is Apex's own implementation on its existing flight model. Flight mode
names remain direction aim/direct; full-real trim/SAS profiles, War Thunder's
exact sight-line calibration and crew fatigue are not newly claimed features.
The MiG-23MLD 500/400 km/h and Mach 1.1/1.0 sweep schedule is retained.

Validation:

- `npm run build:combat` writes a pre-instructor comparison module and the
  extended module deterministically.
- `python3 .deployment/restore.py` restores readable overrides. Copy the
  newly built `web/flight.wasm` to `public/flight.wasm` before running tests.
- `node tests/pilot-instructor.mjs` exercises 64 native aircraft/mask cases,
  manual command authority and unowned assistance, ownership resets, all
  17 legacy native trajectories, curves, opposite inputs, pointer handoff,
  inverted/vertical pointing and reset behavior.
- `tests/pilot-instructor-browser.py` drives actual desktop keys, simultaneous
  mouse input, settings persistence and mobile touch pointer capture through
  app.js into the real native controller. Test-only hooks are not shipped.

The Pages workflow rebuilds the compiled module from source. The committed
payload and its encoded original archive remain unchanged.

## Measured response correction (2026-11-12)

The initial axis-ownership checks did not establish handling quality. The new
`tests/pilot-response.mjs` measures actual aircraft attitude over time, including
sustained acquisition, moving targets, input delivery frequency and camera
continuity. Results and initial conditions are recorded in
`docs/reviews/controls/20261112-response.json`.

Player direction aim now opts into `set_instructor_response(1)`. For stationary
or slowly moving targets, its bank-cone allowance decreases continuously with
angular error instead of retaining a sideslip-blocked cone until after arrival.
It blends back to the existing predictive solver as target angular velocity
increases. Bomber and propeller cone profiles are retained. Su-35/MiG-29 receive
additional sideslip feedback before native FBW; held manual yaw still replaces
the assisted command exactly. The opt-in defaults to off, clears on respawn/type
changes and is never requested by AI. Direct controls remain unchanged.

Pointer targets are resampled spherically on the 120 Hz physics clock with a
20 ms time constant. This prevents render-sized input batches from alternating
between a jump and zero target velocity across catch-up ticks. The visible
reticle and keyboard/stick commands remain immediate. Reset/release clears the
resampling history. The chase camera now damps a rotation on the unit sphere and
transports its up vector, avoiding Euler-heading/world-up flips at the poles.

For a 20 degree horizontal target at 220 m/s TAS and 4,500 m, time to enter and
remain inside a 1 degree error band changed as follows (seconds):

| Aircraft | Before | After |
| --- | ---: | ---: |
| F-22A | 5.53 | 4.11 |
| F-14D | 6.02 | 4.43 |
| MiG-15bis | 7.15 | 3.50 |
| MiG-23MLD | 5.77 | 4.27 |

Su-35/MiG-29 previously failed to remain inside that band within 20 seconds;
they now settle in 4.77/5.99 seconds, with final two-second mean errors below
0.02 degrees. Native actuator rates, G/AoA protections, aerodynamic forces,
damage, weapons and the MiG-23 sweep schedule are retained.

Validation covers 84 static target cases across all 14 jets, 64 assisted/manual
ownership combinations, and moving-target replays at 20/30/60/120 Hz for six
aircraft. Those replay rates are not hardware FPS measurements. Desktop/mobile
UI interaction is checked separately by the Chromium workflow.
