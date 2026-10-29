# Project: Apex — Joint Air Dominance

Web game for https://project-apex.kro.kr. Accounts and rewards use the deployed Supabase API.

GitHub Actions verifies and restores the game payload, then publishes only the public game files to Pages. Enable Settings → Pages → GitHub Actions, set the custom domain to project-apex.kro.kr, and set its DNS CNAME to dasol1819.github.io.

The .deployment/web-*.b64 files are the ordered parts of a SHA-256 verified ZIP. Run python3 .deployment/restore.py to inspect or develop the exported web files locally. Existing desktop/Android app downloads and their signed update channel remain on the original service.

The original administrator account is not migrated. Assign the owner a new-service administrator role after identifying their new account.

## Su-35S exterior studio

Open `/su35.html`, or choose Russia → Su-35S → 3D exterior studio in the aircraft tree. This is an independently authored, metre-scale exterior preview. It includes open recessed inlet ducts, an offset IRST, an opening canopy, landing gear and articulated nozzles. Su-35 flight physics, radar and armament are not implemented; the tree deliberately has no Su-35 native simulation ID.

Readable additions and modified web modules live in `web/`. After editing, run `python3 scripts/update-web-manifest.py`. The restore script verifies the original payload, then verifies and copies these overrides using `web/manifest.json`; the encoded payload and its original checksum stay unchanged. Running the saved environment install script refreshes the local preview too.

After restoring, run `node tests/su35-geometry.mjs /path/to/restored/public` (Node 24). The checks cover actual inlet ray intersections, visible dimensions, moving mechanisms and the existing 13 aircraft. Browser checks are in `tests/su35-browser.py` (Playwright and Chromium), with `APEX_TEST_URL` selecting the preview server.
