# Aircraft factory cache migration — 2026-11-14 Seoul

Returning clients could keep pre-fin aircraft factory responses after PR #39. The flight bootstrap imported `aircraft.js?v=fa18b-1`, inspector/combat imported `?v=mig23mld-13`, and the graphics workload imported `?v=inspector-5`. A previously cached factory could still import the pre-partition `mig23mld-game.js?v=13`, leaving the source fin attached after native part-5 loss. Comparing arbitrary current file bytes at a different query URL did not test this migration.

The four consumers now use `aircraft.js?v=factory-20261114-1`. The HTML entry and the inspector/combat/workload module versions advance too, so those modules load the shared current factory. No model, UV, texture, native flight/control, weapon, damage-profile or station data changes. F/A-18B integration and the separate assisted-stick PR #38 remain intact. No aircraft is promoted to implemented/reviewed.

## Actual gameplay reproduction

`tests/aircraft-cache-browser.py` serves the original pre-fin factory/game responses from commit `8522f9113e4fbe81245b1803cd384f6a96f93de3` at their old versioned URLs. Baseline mode reconstructs only the four recorded pre-fix import specifiers; other candidate application/native bytes are held constant. The original GLB, real native simulation, renderer, materials and fin gameplay suite run normally. The fixture represents old versioned HTTP responses, not complete browser disk-cache eviction behavior.

- Baseline: three factory URLs; native fin health zero, original fin/root fittings still attached, empty/unmapped native debris. The original source root is not registered as native part 5.
- Candidate: one factory URL; original fixed fin and fittings removed; **972 triangles / 5 mapped meshes** follow the real native body, with the independent rudder and reset/parent loss checks passing.
- Measured fixture factory response bytes: **169,758 → 56,586**, saving **113,172 bytes** for that module. This is not a whole-page transfer or FPS claim. HTTP cache is disabled by inspection routing; no general browser cache-hit/eviction percentage is claimed.
- Readable runtime JS/HTML changes add **52 bytes** across the five changed files. Manifest metadata is separate. The original GLB remains 22,593,404 bytes; rebuilt native output remains 344,687 bytes / SHA-256 `ac0f479cb659f61c309277782834306aa9753c03fc58ce74dbefbeabd1fbe007`.

Fixture provenance and exact Git blob IDs are in `tests/fixtures/aircraft-cache/README.md`. These historical scripts stay under tests and are not copied into the deployed web directory. Tim Samedov's existing CC BY 4.0 model/source/texture attribution is preserved. No War Thunder assets or fabricated reference photographs are used.

## Production verification and limits

The earlier fin release was recovered from GitHub, restored and rebuilt. Its 13 HTTP files match 23,277,261 validated bytes. Actual operating-domain native fin and cached-source-arrival suites now pass under Chromium 141/SwiftShader through the normal inherited proxy: original 972 mapped triangles; loaded-source fin parent/rudder/reset behavior; cached fallback 1,746→972 with native data/identity/pose unchanged and clean reset. The text-response inspection adapter now handles both spaced and compact Python assignments; hooks remain response-only.

The byte verifier derives the actual cache versions from validated HTML/JS and checks coherence across all four factory consumers. This avoids checking an unused query URL while the application imports a different version. Final cache candidate CI, operating bytes and actual published renders must pass before this candidate is described as deployed. Remaining production tail/photo-camera and same-tick preservation checks are recorded in the final validation report when completed.

The original actual-game/48% photo overlaps remain preserved; fin-tip/rudder/intake and unmatched overhead/rear/active R-35 plume differences remain open. A cache migration does not establish complete exterior accuracy, hardware FPS/VRAM or full aircraft combat certification. MiG-23MLD remains `in_progress`; preserve the initial 15-aircraft review and unfinished MiG-15bis.
