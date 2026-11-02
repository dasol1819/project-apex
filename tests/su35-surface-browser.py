"""Render the packed surface, native GPU formats, fallback and real mobile inspector."""

import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright

base = os.environ.get("APEX_TEST_URL", "http://127.0.0.1:8000").rstrip("/")
out = Path(os.environ.get("APEX_TEST_OUTPUT", "/tmp/su35-surface-test"))
out.mkdir(parents=True, exist_ok=True)
errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"),
        headless=True,
        args=[
            "--no-sandbox",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
        ],
    )

    def watch(page):
        page.set_default_timeout(120000)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on(
            "console",
            lambda m: (
                errors.append(m.text)
                if m.type == "error" or (m.type == "warning" and "INVALID_" in m.text)
                else None
            ),
        )
        page.on(
            "response",
            lambda r: (
                errors.append(str(r.status) + ": " + r.url) if r.status >= 400 else None
            ),
        )

    context = browser.new_context(
        viewport={"width": 1440, "height": 1000}, reduced_motion="reduce"
    )
    page = context.new_page()
    watch(page)
    page.goto(base + "/su35.html?view=surface", wait_until="domcontentloaded")
    page.wait_for_selector("html[data-su35-ready=true]")
    assert page.evaluate("su35Studio.view") == "surface"
    assert page.locator("[data-view=surface]").get_attribute("aria-pressed") == "true"
    page.screenshot(path=str(out / "surface-preset.png"))
    stats = page.evaluate(
        """()=>{const s=su35Studio,materials=new Set();s.model.group.traverse(o=>{if(o.material?.userData.su35Surface)materials.add(o.material)});const maps=[...materials].map(m=>m.normalMap);if(!maps.length||new Set(maps).size!==1)throw Error('surface atlas must be shared');if([...materials].some(m=>m.bumpMap))throw Error('albedo bump must be removed');const t=maps[0];return{...s.model.group.userData.surfaceTextures,dimensions:[t.image.width,t.image.height],mips:t.mipmaps.length,skinMaterials:materials.size}}"""
    )
    assert stats["dimensions"] == [4096, 4096] and stats["mips"] == 13, stats
    assert stats["gpuBytes"] <= 22369700 and stats["backend"] != "rgba8-2k", stats
    print(json.dumps(stats), flush=True)
    for name, eye, at in [
        ("wing", [4.7, 3.1, -0.4], [3.5, 0.55, 2.3]),
        ("nose", [2.5, 2.0, -7.6], [0.55, 0.6, -5.6]),
    ]:
        page.evaluate(
            """async([eye,at])=>{const T=await import('./vendor/three.module.js'),s=su35Studio;s.camera.fov=35;s.camera.position.copy(s.model.group.localToWorld(new T.Vector3(...eye)));s.camera.lookAt(s.model.group.localToWorld(new T.Vector3(...at)));s.camera.updateProjectionMatrix();s.renderer.render(s.scene,s.camera);if(s.renderer.getContext().getError()!==0)throw Error('GPU surface upload/render error')}""",
            [eye, at],
        )
        page.screenshot(path=str(out / (name + ".png")))
    # Exercise every supported native format with actual uploads to this renderer.
    formats = page.evaluate(
        """async()=>{const s=su35Studio,gl=s.renderer.getContext(),{loadGpuSurface}=await import('./gpu-surface-texture.js?v=1'),mats=new Set();s.model.group.traverse(o=>{if(o.material?.userData.su35Surface)mats.add(o.material)});const old=[...mats].map(m=>[m,m.normalMap]),results=[];
 const use=t=>{for(const m of mats){m.normalMap=t;m.needsUpdate=true}s.renderer.render(s.scene,s.camera);if(gl.getError()!==0)throw Error('compressed surface GL error')};
 for(const ext of ['WEBGL_compressed_texture_astc','EXT_texture_compression_bptc','WEBGL_compressed_texture_etc','WEBGL_compressed_texture_s3tc']){
  if(!gl.getExtension(ext))continue;
  const renderer={getContext:()=>({getExtension:n=>n===ext?gl.getExtension(n):null}),capabilities:s.renderer.capabilities};
  const t=await loadGpuSurface({renderer,url:'./assets/su35/surface.ktx2.gz?v=surface-1',fallbackUrl:'./assets/su35/surface-fallback.webp?v=surface-1'});
  if(!t.isCompressedTexture)throw Error(t.userData.surfaceFallbackReason||'native format silently fell back');use(t);results.push(t.userData.surfaceBackend);
  for(const[m,map]of old){m.normalMap=map;m.needsUpdate=true}t.dispose();
 }
 const fallback=await loadGpuSurface({renderer:s.renderer,forceFallback:true,fallbackUrl:'./assets/su35/surface-fallback.webp?v=surface-1'});use(fallback);
 if(fallback.image.width!==2048||fallback.image.height!==2048||fallback.isCompressedTexture)throw Error('2K fallback failed');
 for(const[m,map]of old){m.normalMap=map;m.needsUpdate=true}fallback.dispose();s.renderer.render(s.scene,s.camera);return results}"""
    )
    assert formats, formats
    print("native formats and 2K fallback", formats, flush=True)
    assert not errors, errors
    context.close()
    mobile = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=1,
        is_mobile=True,
        has_touch=True,
        reduced_motion="reduce",
    )
    page = mobile.new_page()
    watch(page)
    page.goto(base + "/?screen=tree&aircraft=13", wait_until="domcontentloaded")
    page.wait_for_selector("html[data-raptor-ready=true]")
    page.locator("[data-tree-nation=ru]").tap()
    page.locator("[data-tree-aircraft=ru-su35-s]").tap()
    page.locator("#tree-inspect-model").tap()
    page.wait_for_selector("#aircraft-inspector[data-ready=true]")
    assert "Su-35S" in page.locator("#inspector-title").inner_text()
    for view in ["top", "intake", "nozzle"]:
        page.locator(f"[data-inspector-view={view}]").tap()
        page.evaluate(
            "()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))"
        )
        page.screenshot(path=str(out / ("mobile-" + view + ".png")))
    assert page.locator("#aircraft-inspector").evaluate(
        "(e)=>e.scrollWidth<=innerWidth"
    )
    page.locator("#inspector-close").tap()
    assert not errors, errors
    mobile.close()
    browser.close()
print(
    json.dumps(
        {
            "result": "PASS",
            "surface": stats,
            "nativeFormats": formats,
            "fallback2K": True,
            "inGameMobile": True,
            "pageAndShaderErrors": errors,
        }
    )
)
