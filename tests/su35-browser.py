"""Exercise the rendered studio and its entry point without account mutations."""
import json
import math
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

base = os.environ.get('APEX_TEST_URL', 'http://127.0.0.1:8000').rstrip('/')
out = Path(os.environ.get('APEX_TEST_OUTPUT', '/tmp/su35-browser'))
out.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),
        headless=True, args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
    page = context.new_page()
    errors = []
    shader_errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: shader_errors.append(m.text) if m.type == 'error' else None)
    page.goto(base + '/su35.html', wait_until='networkidle')
    page.wait_for_selector('html[data-su35-ready=true]')
    assert not errors and not shader_errors, (errors, shader_errors)
    for name in ['front', 'top', 'rear', 'intake', 'nozzle', 'cockpit', 'overview']:
        page.locator(f'[data-view={name}]').click()
        assert page.locator(f'[data-view={name}]').get_attribute('aria-pressed') == 'true'
        assert page.evaluate('su35Studio.view') == name
    page.locator('#canopy').check()
    page.wait_for_function('su35Studio.pose.canopy > .95')
    page.locator('#gear').uncheck()
    page.wait_for_function('su35Studio.pose.gear === 0')
    for name, value in [('ramp', '12'), ('vector', '15'), ('aperture', '100')]:
        page.locator('#' + name).fill(value)
        page.locator('#' + name).dispatch_event('input')
    page.wait_for_function('su35Studio.pose.intakeRamp > .20 && su35Studio.pose.vectorPitch > .26 && su35Studio.pose.afterburner === 1')
    assert page.locator('#ramp-value').inner_text() == '12°'
    page.locator('#reset-view').click()
    page.wait_for_function('su35Studio.pose.gear === 1 && su35Studio.pose.canopy === 0')
    assert page.locator('#aperture-value').inner_text() == '30%'
    before = page.evaluate('su35Studio.camera.position.toArray()')
    canvas = page.locator('#model-canvas')
    canvas.focus()
    page.keyboard.press('ArrowLeft')
    page.wait_for_function('(before)=>su35Studio.camera.position.toArray().some((v,i)=>Math.abs(v-before[i])>.1)', arg=before)
    box = canvas.bounding_box()
    page.mouse.move(box['x'] + box['width'] * .5, box['y'] + box['height'] * .5)
    page.mouse.down()
    page.mouse.move(box['x'] + box['width'] * .6, box['y'] + box['height'] * .55, steps=3)
    page.mouse.up()
    page.keyboard.press('Home')
    with page.expect_download() as download:
        page.locator('#save-view').click()
    export = out / 'Su35S-export.png'
    download.value.save_as(export)
    assert export.read_bytes().startswith(b'\x89PNG') and export.stat().st_size > 10000
    page.screenshot(path=str(out / 'desktop.png'))
    assert not errors and not shader_errors, (errors, shader_errors)
    context.close()

    mobile = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1,
        is_mobile=True, has_touch=True, reduced_motion='reduce')
    page = mobile.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base + '/su35.html', wait_until='networkidle')
    page.wait_for_selector('html[data-su35-ready=true]')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'mobile horizontal overflow'
    page.locator('[data-view=intake]').tap()
    assert page.evaluate('su35Studio.view') == 'intake'
    page.locator('#model-canvas').scroll_into_view_if_needed()
    page.screenshot(path=str(out / 'mobile.png'), full_page=True)
    assert not errors, errors
    mobile.close()

    # Follow the real tree entry point, with no native aircraft ID assigned.
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base + '/?screen=tree', wait_until='domcontentloaded')
    page.locator('[data-tree-nation=ru]').click()
    page.locator('[data-tree-aircraft=ru-su35-s]').click()
    assert '외형' in page.locator('#tree-detail-status').inner_text()
    assert page.locator('#tree-choose').is_disabled()
    assert page.locator('#tree-inspect-model').is_enabled()
    page.locator('#tree-inspect-model').click()
    page.wait_for_url('**/su35.html*')
    page.wait_for_selector('html[data-su35-ready=true]')
    assert not errors, errors
    context.close()
    browser.close()
    print(json.dumps({'result': 'PASS', 'views': 7, 'mechanisms': 5,
        'keyboardAndPointer': True, 'pngExport': export.stat().st_size,
        'mobileWidth': 390, 'treeNavigation': True, 'pageErrors': errors}, ensure_ascii=False))
