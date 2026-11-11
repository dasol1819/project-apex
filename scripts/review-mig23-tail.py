"""Rebuild the MiG-23MLD tail contact sheet and registered photo comparison.

Inputs are the unmodified US Navy photograph and tests/mig23-browser.py PNGs.
The recipe records the two selected landmarks; no part receives a separate warp.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--captures', type=Path, required=True)
parser.add_argument('--photo', type=Path, required=True)
parser.add_argument('--recipe', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
recipe = json.loads(args.recipe.read_text())
args.output.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype('DejaVuSans.ttf', 22)
small = ImageFont.truetype('DejaVuSans.ttf', 17)

sheet = Image.new('RGB', (1280, 1935), '#111c28')
draw = ImageDraw.Draw(sheet)
draw.text((20, 15), 'MiG-23MLD / native tail outputs / actual game renderer', font=font, fill='white')
for i, (name, label) in enumerate(recipe['samples']):
    shot = Image.open(args.captures / ('mig23-tail-' + name + '.png')).convert('RGB')
    shot = shot.crop(tuple(recipe['tailCrop'])).resize((620, 570), Image.Resampling.LANCZOS)
    x, y = 10 + (i % 2) * 640, 55 + (i // 2) * 610
    sheet.paste(shot, (x, y + 25))
    draw.text((x + 5, y), label, font=small, fill='white')
draw.text((20, 1900), 'Chromium 141 / SwiftShader. Tim Samedov model: CC BY 4.0. Inspection camera; not a hardware FPS test.', font=small, fill='white')
sheet.save(args.output / '12-native-tail-controls.jpg', quality=87)

photo = Image.open(args.photo).convert('RGB')
render = Image.open(args.captures / 'mig23-tail-overlay-png.png').convert('RGB')
background = Image.open(args.captures / 'mig23-tail-overlay-background.png').convert('RGB')
delta = ImageChops.difference(render, background)
r, g, b = delta.split()
mask = ImageChops.lighter(ImageChops.lighter(r, g), b).point(lambda v: 255 if v > 8 else 0)
render.putalpha(mask)
p0, p1 = [complex(*p) for p in recipe['renderAnchors']]
q0, q1 = [complex(*p) for p in recipe['photoAnchors']]
c = (q1 - q0) / (p1 - p0)
t = q0 - c * p0
a, b, den = c.real, c.imag, abs(c) ** 2
inverse = (a / den, b / den, (-a * t.real - b * t.imag) / den,
           -b / den, a / den, (b * t.real - a * t.imag) / den)
registered = render.transform(photo.size, Image.Transform.AFFINE, inverse, Image.Resampling.BICUBIC)
registered.putalpha(registered.getchannel('A').point(lambda v: round(v * recipe['opacity'])))
overlay = Image.alpha_composite(photo.convert('RGBA'), registered).convert('RGB')
marks = ImageDraw.Draw(overlay)
for x, y in recipe['photoAnchors']:
    marks.line((x - 18, y, x + 18, y), fill='#00ffff', width=3)
    marks.line((x, y - 18, x, y + 18), fill='#00ffff', width=3)

canvas = Image.new('RGB', (1500, 1420), '#111c28')
draw = ImageDraw.Draw(canvas)
draw.text((20, 15), 'MiG-23MLD / US Navy no.34 / registered actual game render at 48%', font=font, fill='white')
canvas.paste(overlay.resize((1500, 732), Image.Resampling.LANCZOS), (0, 55))
for x, image, label in [(10, photo, 'Reference tail'), (760, overlay, 'Same transform / tail detail')]:
    crop = image.crop(tuple(recipe['photoTailCrop']))
    crop.thumbnail((730, 550), Image.Resampling.LANCZOS)
    canvas.paste(crop, (x, 835))
    draw.text((x + 10, 800), label, font=font, fill='white')
draw.text((20, 1390), 'Photo: US Navy, 1986, public domain. Model: Tim Samedov, CC BY 4.0. Perspective/control-state residuals remain.', font=small, fill='white')
canvas.save(args.output / '13-tail-photo-overlay.jpg', quality=88)
print(json.dumps({'scale': abs(c), 'rotationRadians': __import__('math').atan2(c.imag, c.real),
                  'translation': [t.real, t.imag], 'opacity': recipe['opacity']}))
