// Actual Chromium/WebGL/WASM/UI smoke test, using only the repository's own code.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';

const out = resolve(process.env.APEX_TEST_OUTPUT || 'artifacts/webgl');
await mkdir(out, { recursive: true });
const report = { checkedAt: new Date().toISOString(), result: 'RUNNING', tests: [], errors: [],
  limitation: 'Chromium ANGLE/SwiftShader on CPU. Mobile is viewport/touch emulation; no physical-device GPU or hardware FPS claim.' };
let server, browser, activePage;
let base = process.env.APEX_TEST_URL;
const checkpoint = async () => writeFile(resolve(out, 'browser.json'), JSON.stringify(report, null, 2) + '\n');
const hook = `\nwindow.__apexQA={get renderer(){return renderer},get sim(){return sim},get aircraft(){return aircraft},get ready(){return ready},get started(){return started},get paused(){return paused},get playerType(){return playerType},get inspector(){return aircraftInspector},readState};\n`;
try {
  if (!base) {
    assert.ok(process.env.CI, 'Outside CI, set APEX_TEST_URL to the supported running preview.');
    const root = resolve(process.argv[2] || 'public');
    const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.wasm':'application/wasm',
      '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg' };
    server = createServer(async (req, res) => {
      try {
        const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const file = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
        if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
        const data = await readFile(file);
        res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
        res.end(data);
      } catch { res.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  }
  base = base.replace(/\/$/, '');
  // Explicit software graphics backend for a GPU-less, ephemeral trusted-code CI runner.
  // Leave browser sandboxing and certificate validation at Playwright's normal defaults.
  const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  report.launch = { args, executable: process.env.CHROMIUM_PATH || chromium.executablePath() };
  browser = await chromium.launch({ headless: true, args,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  report.browserVersion = browser.version();

  async function pageFor(context) {
    const page = await context.newPage();
    activePage = page;
    page.setDefaultTimeout(120000);
    page.on('pageerror', error => report.errors.push({ type: 'page', message: error.stack }));
    page.on('console', message => {
      if (message.type() === 'error') report.errors.push({ type: 'console', message: message.text() });
    });
    page.on('response', response => {
      if (response.status() >= 400) report.errors.push({ type: 'http', status: response.status(), url: response.url() });
    });
    page.on('requestfailed', request => report.errors.push({ type: 'network', url: request.url(), error: request.failure() }));
    return page;
  }

  const diagnosticContext = await browser.newContext();
  let page = await pageFor(diagnosticContext);
  await page.goto(base + '/diagnostics.html', { waitUntil: 'domcontentloaded' });
  await page.locator('html[data-diagnostic-ready=true]').waitFor();
  report.diagnostics = JSON.parse(await page.locator('#diagnostic-report').textContent());
  await page.screenshot({ path: resolve(out, 'diagnostics.png'), fullPage: true });
  await checkpoint();
  assert.equal(report.diagnostics.result, 'PASS', JSON.stringify(report.diagnostics));
  assert.equal(report.diagnostics.webgl2.drawPassed, true, 'A context alone does not prove rendering');
  report.tests.push('WebGL 2 shaders + framebuffer pixel readback + WASM validation');
  await diagnosticContext.close();

  for (const mobile of [false, true]) {
    const label = mobile ? 'mobile' : 'desktop';
    const activate = locator => mobile ? locator.tap() : locator.click();
    const context = await browser.newContext({ viewport: mobile ? { width:390, height:844 } : { width:1100, height:760 },
      deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    await context.addInitScript(() => localStorage.setItem('raptor.graphics.v2', 'minimum'));
    page = await pageFor(context);
    // Test-only read access to module state. No test hook is shipped to production.
    await page.route('**/app.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + hook });
    });
    await page.goto(base + '/?screen=tree&aircraft=15', { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.raptorReady === 'true'
      || document.documentElement.dataset.raptorError);
    const bootError = await page.locator('html').getAttribute('data-raptor-error');
    assert.equal(bootError, null, await page.locator('#load-status').textContent());
    await page.waitForFunction(() => window.__apexQA?.ready && __apexQA.renderer.info.render.calls > 0);
    assert.equal(await page.evaluate(() => __apexQA.sim.get_aircraft_type()), 15);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, label + ' overflow');
    await activate(page.locator('[data-tree-nation=ru]'));
    await activate(page.locator('[data-tree-aircraft=ru-mig15-bis]'));
    await activate(page.locator('#tree-inspect-model'));
    await page.locator('#aircraft-inspector[data-ready=true]').waitFor();
    assert.match(await page.locator('#inspector-title').textContent(), /MiG-15bis/);
    const views = mobile ? ['intake','rear','bottom'] : ['front','top','bottom','rear','intake','nozzle','cockpit','overview'];
    for (const view of views) {
      await activate(page.locator(`[data-inspector-view=${view}]`));
      assert.equal(await page.locator(`[data-inspector-view=${view}]`).getAttribute('aria-pressed'), 'true');
      // Wait for the dirty inspector frame after changing the camera.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.screenshot({ path: resolve(out, `${label}-${view}.png`) });
    }
    await page.locator('#inspector-gear').uncheck();
    await page.locator('#inspector-canopy').check();
    await page.screenshot({ path: resolve(out, `${label}-mechanisms.png`) });
    await activate(page.locator('#inspector-close'));
    await activate(page.locator('#tree-prepare'));
    await activate(page.locator('[data-brief-tab=battle]'));
    await page.locator('#ally-count').selectOption('1');
    await page.locator('#enemy-count').selectOption('1');
    await activate(page.locator('#launch'));
    await page.waitForFunction(() => __apexQA.started && __apexQA.readState()[32] > 0.2);
    await page.locator('#throttle').fill('100');
    await page.locator('#throttle').dispatchEvent('input');
    const startTime = await page.evaluate(() => __apexQA.readState()[32]);
    await page.waitForFunction(time => __apexQA.readState()[32] > time + 0.1, startTime);
    report[label] = await page.evaluate(() => {
      const q = __apexQA, gl = q.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
      return { nativeType:q.sim.get_aircraft_type(), modelType:q.aircraft.definition.id,
        simulationSeconds:q.readState()[32], finiteState:Array.from(q.readState()).every(Number.isFinite),
        renderer:gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
        contextLost:gl.isContextLost(), glError:gl.getError(),
        drawCalls:q.renderer.info.render.calls, triangles:q.renderer.info.render.triangles };
    });
    assert.equal(report[label].nativeType, 15);
    assert.equal(report[label].modelType, 15);
    assert.equal(report[label].finiteState, true);
    assert.equal(report[label].contextLost, false);
    assert.equal(report[label].glError, 0);
    assert.ok(report[label].drawCalls > 0 && report[label].triangles > 1000);
    await page.screenshot({ path: resolve(out, `${label}-flight.png`) });
    report.tests.push(`${label}: tree, MiG-15bis inspector (${views.length} views), mechanisms, sortie, throttle, native simulation, WebGL draw`);
    await checkpoint();
    await context.close();
    console.log(label + ' WebGL gameplay PASS');
  }
  assert.deepEqual(report.errors, []);
  report.result = 'PASS';
} catch (error) {
  report.result = 'FAIL';
  report.failure = error.stack;
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: resolve(out, 'failure.png') }).catch(() => {});
    await writeFile(resolve(out, 'failure.html'), await activePage.content().catch(() => '')).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  await checkpoint();
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  console.log(JSON.stringify(report, null, 2));
}
