# Pre-fin versioned response fixtures

Exact repository files from commit `8522f9113e4fbe81245b1803cd384f6a96f93de3`:

- `legacy-aircraft.js`: original `web/aircraft.js`, Git blob `a7d7c4e8b534b0cae80ad517d7ebef18ee799442`.
- `legacy-mig23mld-game.js`: original `web/mig23mld-game.js`, Git blob `50de478a6d73de022997e76c8de1c587e60b54b4`.

These test-only files are served at the old factory/game URLs to represent cached pre-fin responses. They are not copied to the deployed web directory. The real original GLB, native module, shaders and gameplay suite are used. No War Thunder or third-party model assets are included here. Tim Samedov's existing model attribution/license remains unchanged.

This is a versioned-response migration fixture, not a complete test of browser disk-cache eviction. The baseline reproduces native health zero with an original fin/fittings still attached and an empty debris body. The candidate must load one current factory URL and detach the mapped original 972 triangles.
