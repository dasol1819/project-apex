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
