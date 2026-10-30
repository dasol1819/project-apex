# Project: Apex — Joint Air Dominance

Web game for https://project-apex.kro.kr. Accounts and rewards use the deployed Supabase API.

GitHub Actions verifies and restores the game payload, then publishes only the public game files to Pages. Enable Settings → Pages → GitHub Actions, set the custom domain to project-apex.kro.kr, and set its DNS CNAME to dasol1819.github.io.

The .deployment/web-*.b64 files are the ordered parts of a SHA-256 verified ZIP. Run python3 .deployment/restore.py to inspect or develop the exported web files locally. Existing desktop/Android app downloads and their signed update channel remain on the original service.

The original administrator account is not migrated. Assign the owner a new-service administrator role after identifying their new account.

## Su-35S exterior studio

Open `/su35.html`, or choose Russia → Su-35S → 3D exterior studio in the aircraft tree. This metre-scale exterior study adapts the UV-mapped FGUK / FlightGear Su-27 Flanker base to a Su-35S game reconstruction. The original geometry and textures are credited to Lee Elliott, StuartC and VooDoo and are distributed under GPL-2.0. The adaptation includes a starboard IRST, wingtip equipment, recessed inlet ducts, modern cockpit displays, opening canopy, landing gear and articulated exhaust nozzles. Su-35 flight physics, radar and armament are not implemented; the tree deliberately has no Su-35 native simulation ID.

Readable additions and modified web modules live in `web/`. After editing, run `python3 scripts/update-web-manifest.py`. The restore script verifies the original payload, then verifies and copies these overrides using `web/manifest.json`; the encoded payload and its original checksum stay unchanged. Running the saved environment install script refreshes the local preview too.

After restoring, run `node tests/su35-geometry.mjs /path/to/restored/public` (Node 24). The checks cover actual inlet ray intersections, visible dimensions, moving mechanisms and the existing 13 aircraft. Browser checks are in `tests/su35-browser.py` (Playwright and Chromium), with `APEX_TEST_URL` selecting the preview server.

The pinned original AC3D model, textures, license and editable Blender adaptation are in `assets/su35-source/`. Rebuild with Blender 4.3: `blender -b --factory-startup --threads 4 --python scripts/su35/build_asset.py -- --bake`. The Python converter preserves UVs and smooth normals, removes the old intake caps and fixed exhaust exits, refines the skin and bakes a shared ambient occlusion atlas. The browser loads the compressed mesh, original albedo and baked occlusion; source material remains traceable to the pinned upstream revision. A corresponding-source archive is linked in the studio footer. This is a visual reconstruction rather than manufacturer CAD.
