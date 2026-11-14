# Counterexample: source wing roots without late child ownership

This is our unpublished first source-wing-root candidate, before the eight empty child roots were introduced. It is not a historical deployed release. Its exact Git blob is `0e3e0fbbf7ca1a620d11e1097f90ebe309b0f0df`. Relative to main84fe619 it registers existing source roots1/2 and imports glb4, but leaves the public child pointers on the fallback.

Run the actual cached-source suite with `APEX_TEST_GAME_SOURCE=tests/fixtures/mig23-wing/before-child-ownership.js APEX_EXPECT_PENDING_CHILD_TRIANGLES=2742 APEX_TEST_PART=1`. The original root636 triangles replace its fallback, but2742 generic child triangles persist. The current game requires0. Native actor data/position/identity remain identical. This fixture is not restored into the published web directory. Original model attribution/license (Tim Samedov, CC BY4.0) remains unchanged; no model/maps are duplicated here.
