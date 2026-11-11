"""Register a current game render over the preserved public-domain photo crop.

The original download may be unavailable. The reference pixels here are the
unblended photograph reproduced in 13-tail-photo-overlay.jpg, with its recorded
crop/scale. No aircraft component receives an individual warp.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFont

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--captures', type=Path, required=True)
p.add_argument('--review', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
a = p.parse_args()
r = json.loads((a.review / 'tail-overlay-recipe.json').read_text())
reference = Image.open(a.review / '13-tail-photo-overlay.jpg').convert('RGB').crop((10, 835, 739, 1385))
render = Image.open(a.captures / 'mig23-tail-overlay-png.png').convert('RGB')
background = Image.open(a.captures / 'mig23-tail-overlay-background.png').convert('RGB')
channels = ImageChops.difference(render, background).split()
mask = ImageChops.lighter(ImageChops.lighter(channels[0], channels[1]), channels[2]).point(lambda v: 255 if v > 8 else 0)
render.putalpha(mask)
p0, p1 = [complex(*v) for v in r['renderAnchors']]
q0, q1 = [complex(*v) for v in r['photoAnchors']]
c = (q1 - q0) / (p1 - p0)
t = q0 - c * p0
den = abs(c) ** 2
inverse = (c.real / den, c.imag / den, (-c.real * t.real - c.imag * t.imag) / den,
           -c.imag / den, c.real / den, (c.imag * t.real - c.real * t.imag) / den)
registered = render.transform((3000, 1465), Image.Transform.AFFINE, inverse, Image.Resampling.BICUBIC)
registered = registered.crop(tuple(r['photoTailCrop'])).resize(reference.size, Image.Resampling.LANCZOS)
registered.putalpha(registered.getchannel('A').point(lambda v: round(v * r['opacity'])))
overlay = Image.alpha_composite(reference.convert('RGBA'), registered).convert('RGB')
canvas = Image.new('RGB', (1500, 650), '#111c28')
d = ImageDraw.Draw(canvas)
font = ImageFont.truetype('DejaVuSans.ttf', 20)
small = ImageFont.truetype('DejaVuSans.ttf', 16)
for x, image, label in [(10, reference, 'Preserved US Navy photo crop'), (760, overlay, 'Current game render / same registration / 48%')]:
    d.text((x, 12), label, font=font, fill='white')
    canvas.paste(image, (x, 45))
d.text((10, 605), 'Nov 12, 2026 Seoul / Chromium 141 SwiftShader. Photo crop is a JPEG reproduction, not the original download.', font=small, fill='white')
d.text((10, 628), 'US Navy photo: public domain. Tim Samedov model: CC BY 4.0. Fin/root/camera residuals remain; aircraft is not approved.', font=small, fill='white')
a.output.parent.mkdir(parents=True, exist_ok=True)
canvas.save(a.output, quality=89)
