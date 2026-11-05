"""Overlay actual inspector WebGL PNGs at their committed rigid photo cameras.

Run after downloading the webgl-browser-evidence artifact from PR #4's CI.
The photographs and model pixels are never resized, stretched or warped.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('artifacts', type=Path)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
report = json.loads((args.artifacts / 'browser.json').read_text())
assert report['result'] == 'PASS', 'Browser run must pass before comparison'
args.output.mkdir(parents=True, exist_ok=True)
records = []
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
for name in ['side', 'rear']:
    camera = json.loads((ROOT / f'docs/reviews/mig15bis/photo-{name}/camera.json').read_text())
    source = json.loads((ROOT / f'assets/mig15bis/{name}-registration.json').read_text())
    used = next(p for p in report['photoCameras'] if p['name'] == name)
    assert used['size'] == camera['size']
    assert used['view'] == camera['views'][0]['view']
    assert used['projection'] == camera['views'][0]['projection']
    assert used['state'] == source['state'], 'Canopy/gear state must match registration'
    photo_path = ROOT / source['photo']
    render_path = args.artifacts / f'photo-{name}-render.png'
    photo = Image.open(photo_path).convert('RGBA')
    render = Image.open(render_path).convert('RGBA')
    assert photo.size == render.size == tuple(camera['size'])
    alpha = render.getchannel('A')
    assert alpha.getextrema() == (0, 255), 'Expect actual transparent model capture'
    coverage = sum(alpha.histogram()[1:]) / (render.width * render.height)
    assert .01 < coverage < .95, 'Reject empty or opaque-background capture'
    translucent = render.copy()
    translucent.putalpha(alpha.point(lambda a: round(a * .45)))
    overlay = Image.alpha_composite(photo, translucent).convert('RGB')
    mask = alpha.point(lambda a: 255 if a >= 128 else 0)
    edge = ImageChops.subtract(mask, mask.filter(ImageFilter.MinFilter(3)))
    outline = photo.convert('RGB')
    outline.paste((255, 38, 70), mask=edge)
    w, h = photo.size
    sheet = Image.new('RGB', (w * 3, h + 80), '#17212b')
    draw = ImageDraw.Draw(sheet)
    for i, (im, label) in enumerate([(photo.convert('RGB'), 'REAL PHOTO'),
            (overlay, '45% ACTUAL GAME WEBGL OVERLAY'), (outline, 'GAME SILHOUETTE')]):
        sheet.paste(im, (i * w, 36))
        draw.text((i * w + 12, 12), label, fill='white')
    draw.text((12, h + 48), source['credit'] + ' | actual WebGL inspector | rigid camera, no warping', fill='white')
    output = args.output / f'photo-{name}-comparison.jpg'
    sheet.save(output, quality=91)
    records.append({'name': name, 'size': [w, h], 'photoSHA256': sha(photo_path),
        'renderSHA256': sha(render_path), 'comparisonSHA256': sha(output),
        'maskCoverage': coverage, 'camera': used, 'credit': source['credit']})
(args.output / 'photo-comparison.json').write_text(json.dumps({
    'renderer': report['diagnostics']['webgl2']['renderer'], 'browserVersion': report['browserVersion'],
    'comparisons': records, 'limitation': 'Manual camera correspondence and occlusion errors remain. No complete aircraft visual approval or hardware FPS claim.'}, indent=2) + '\n')
print(json.dumps({'result': 'COMPOSITED', 'comparisons': len(records)}))
