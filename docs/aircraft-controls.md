# Aircraft instructor and mixed-input controls

The native flight module supplies the aerodynamic forces, angular-rate
feedback, aircraft flight envelope, actuator motion and damage. The browser
supplies pilot commands; it never replaces aircraft pose or velocity.

Mouse/touch drag commands a world direction. In assisted control (`aim`), the
screen/gamepad stick commands a bank and normal load: horizontal deflection
holds a bank and coordinates lift/rudder to turn, while vertical deflection
changes normal load. Neutral vertical input maintains the flight path present
when the maneuver began. Bank demand accounts for the aircraft load envelope
and indicated airspeed. On the ground, horizontal deflection also steers the
nosewheel. The native C++ FBW still determines achievable load and AoA limits.

The load request uses the opt-in native `set_pilot_g_command(1)` channel. It
selects the existing load-control loop only with FBW, physical pilot authority
and no ground contact. It defaults off and clears on reset/type changes. AI
never requests it. Direct mode, FBW-off, keyboard axes and the Dagger master
mission retain proportional raw axes. A held sideways stick in direct mode
therefore remains a roll-rate input for aerobatics.

A separate physical-axis correction bypasses an old mouse destination while
held. If the player deliberately moves the pointer during the correction, the
native per-axis API `set_pilot_axis_override(mask)` combines the held axes with
the new mouse goal. Its bits are pitch 1, roll 2 and yaw 4. Owned axes receive
exact manual input before FBW; unowned axes retain direction assistance. A
mixed analog stick retains its bank servo while the new pointer goal controls
unowned axes. The camera and direction indicator follow the nose during a
physical maneuver without a simultaneous pointer gesture.

Screen axes are taken from the camera so banked/inverted input does not reverse.
Target directions can cross the zenith/nadir. The public control mode does not
latch after release.

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

Pointer intent is consumed once on every physics sample, including sorties
without a mission director. Previously that side effect was inside an optional
mission-call argument, so ordinary flight retained an old mouse event forever
and incorrectly treated later manual corrections as simultaneous mouse input.
Releasing those corrections could return to a stale destination. The browser
test now covers mouse movement followed by a separate keyboard correction.

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

## Maneuver stick correction (2026-11-13)

The prior held horizontal stick repeatedly rolled through inverted flight while
unowned direction assistance kept tracking the earlier mouse destination. It
required additional pitch and repeated roll correction to obtain a useful turn.
The assisted stick now maintains a bank and requests the corresponding native
normal load, with flight-path and sideslip feedback. Keyboard axis corrections
also cease tracking a stale destination while held; deliberate simultaneous
mouse input still invokes the mixed-axis controller.

`tests/maneuver-stick.mjs` measures one uninterrupted half-stick gesture for
10 seconds at 220 m/s TAS, 4,500 m, 85% throttle and 120 Hz physics. All 14 jet
profiles are checked in both turn directions, with an additional 120/320 m/s
matrix. For the MiG-23MLD, the right gesture changed course by 0.99 degrees and
lost 157.34 m before; the assisted gesture changes course by 39.00 degrees and
loses 3.86 m, maintaining approximately 59 degrees of bank. These are fixed
simulation conditions, not universal performance or hardware-FPS claims.

Full results: `docs/reviews/controls/20261113-maneuver.json`. The browser test
now holds a real mobile touch through a sustained turn, checks release, and
verifies proportional raw axes in explicit direct mode. It also checks raw
keyboard authority, simultaneous mouse input and the stale-target regression.
