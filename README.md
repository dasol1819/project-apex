# Project: Apex — Joint Air Dominance

Web game for https://project-apex.kro.kr. Accounts and rewards use the deployed Supabase API.

GitHub Actions verifies and restores the game payload, then publishes only the public game files to Pages. Enable Settings → Pages → GitHub Actions, set the custom domain to project-apex.kro.kr, and set its DNS CNAME to dasol1819.github.io.

The .deployment/web-*.b64 files are the ordered parts of a SHA-256 verified ZIP. Run python3 .deployment/restore.py to inspect or develop the exported web files locally. Existing desktop/Android app downloads and their signed update channel remain on the original service.

The original administrator account is not migrated. Assign the owner a new-service administrator role after identifying their new account.
