# Connection and browser WebGL diagnosis

Investigated 2026-11-05 KST. This work repairs the verification path; it does not approve the pending MiG-15bis geometry review.

## Reproduced in the managed review environment

- `http://project-apex.kro.kr/`: HTTP 200; game files are served by GitHub Pages.
- `https://project-apex.kro.kr/`: HTTP 503 from the intermediary, with `upstream connect error or disconnect/reset before headers. reset reason: remote connection failure`. This response alone does not establish whether GitHub's certificate, the TLS route, or the intermediary is at fault.
- The default GitHub Pages URL responds with HTTP 301 to the HTTP custom domain. The review browser upgrades that HTTP address to HTTPS and reaches the failing endpoint.
- Public DNS resolves the CNAME to `dasol1819.github.io.`. It is not an absent-CNAME error.
- In Chrome 155, the independent diagnostic page reproduces context creation failure for WebGL 2 with the game's high-performance/antialias attributes, WebGL 2 with default/no-antialias attributes, and WebGL 1. All report `GL_VENDOR = Disabled`, `GL_RENDERER = Disabled`, and `BindToCurrentSequence failed`. The flight WASM validates, and the entry/model modules return HTTP 200. Thus this failure occurs before game geometry, textures or flight physics can render; reducing texture quality or retrying the same browser cannot enable its disabled graphics backend.
- There is no Chromium executable or Python Playwright package in the current executor. The old Python tests' default `/usr/bin/chromium` cannot run there. The managed browser is a separate surface whose startup graphics flags cannot be changed through page JavaScript.

## Repair

`diagnostics.html` uses normal browser APIs to report context-creation messages, independently compile/draw a shader and read back a known pixel, and validate the actual flight module. A context without successful pixel readback is not a pass. Results stay in the page. The game's startup failure now records its stage and links this page, so file/WASM failures are not all described as GPU problems.

`Browser WebGL and connection QA` installs the pinned Playwright version and its matching Chromium/system dependencies on an ephemeral GitHub runner. Its graphics backend is explicitly ANGLE/SwiftShader, as documented by Chromium. This is for trusted repository code in isolated CI, not a recommendation to change users' normal browser security settings. TLS validation remains enabled.

The browser test runs the real restored game, Three.js shaders and native WASM, follows the MiG-15bis tree/inspector/flight UI, exercises desktop and mobile touch layouts, and retains renderer details, errors and screenshots on both success and failure. Software-rendered browser evidence is distinct from physical mobile/desktop GPU performance and from final visual approval.

The connection job separately records DNS, HTTP redirects, validated HTTPS, Pages metadata/health when its token permits, and deployed file hashes. It fails on broken HTTPS instead of silently accepting an HTTP-only check. This separates an actual external TLS failure from the review environment's own route.

## Reproduce

```sh
python3 .deployment/restore.py
npm ci
npx playwright install --with-deps chromium
CI=true npm run test:browser
python3 scripts/check-connection.py --require-https
```

In a managed Work preview, use its supported preview URL as `APEX_TEST_URL`; the test starts its own local HTTP server only on CI. `CHROMIUM_PATH` is optional; the default is Playwright's matching downloaded browser, not a hardcoded system path. Artifacts are in `artifacts/webgl` and `artifacts/connection`, and in the corresponding workflow run.

Official references:

- https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md
- https://playwright.dev/docs/ci
- https://docs.github.com/en/rest/pages/pages
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages

## Confirmed TLS fault and validation outcome

An independent Qualys SSL Labs assessment completed two IPv6 endpoints. Both received trust grade T. The server presents the default `CN=*.github.io` leaf certificate, with SANs for GitHub domains and **no `project-apex.kro.kr` SAN**. This is a concrete hostname/certificate mismatch, independently of the managed proxy's 503. Public CNAME/A/AAAA and CAA results are consistent with GitHub Pages. The certificate/configuration state in signed-in Pages settings still needs inspection; the available browser is logged out.

Restore the custom-domain certificate through GitHub Pages, inspect issuance status, and rebind the same domain if the issuance process is stale, as GitHub documents. Validate the domain's actual HTTPS certificate/response before enabling HTTPS enforcement. Do not replace this with an application redirect or disable TLS validation.

The deterministic native rebuild is byte-identical. All 11 relevant native/model/surface regressions pass after generating their required baseline files; the initial missing-baseline failures were setup prerequisites. The supported preview verifies the new diagnostic page and the game's WebGL-specific failure guidance/link. Full records are in `evidence.json`.

The new Chromium workflow and deployment gate are prepared but **have not run** because repository upload is currently blocked. No successful browser gameplay, hardware performance, publication or certificate repair is claimed. The MiG-15bis geometry review remains pending.
