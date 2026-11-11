"""Compose original game-renderer captures from tests/mig23-browser.py.
Model: Tim Samedov (citizensnip), MiG-23MLD, CC BY 4.0.
"""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--captures', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype('DejaVuSans.ttf', 20)
small = ImageFont.truetype('DejaVuSans.ttf', 16)
sheet = Image.new('RGB', (1280, 2795), '#111c28')
draw = ImageDraw.Draw(sheet)
draw.text((20, 15), 'MiG-23MLD / four airbrakes / normal native control / actual game renderer', font=font, fill='white')
samples = [
    ('closed', 'Upper: native brake OFF', 'upper'),
    ('closed-lower', 'Lower: native brake OFF', 'lower'),
    ('moving', 'Upper: native travel near 33%', 'upper'),
    ('moving-lower', 'Lower: native travel near 33%', 'lower'),
    ('open-upper', 'Upper: native brake fully deployed', 'upper'),
    ('open-lower', 'Lower: native brake fully deployed', 'lower'),
    ('returned', 'Upper: native brake returned to OFF', 'upper'),
    ('returned-lower', 'Lower: native brake returned to OFF', 'lower'),
    ('closed-aft', 'Aft: closed', 'aft'),
    ('open-aft', 'Aft: all four deployed', 'aft'),
]
crops = {'upper': (400, 250, 1000, 700), 'lower': (250, 150, 1100, 760), 'aft': (200, 80, 1166, 850)}
for i, (name, label, view) in enumerate(samples):
    image = Image.open(args.captures / ('mig23-brakes-' + name + '.png')).convert('RGB')
    image = image.crop(crops[view])
    image.thumbnail((620, 480), Image.Resampling.LANCZOS)
    x, y = 10 + (i % 2) * 640, 70 + (i // 2) * 540
    sheet.paste(image, (x, y + 28))
    draw.text((x + 5, y), label, font=font, fill='white')
draw.text((20, 2760), 'Tim Samedov model: CC BY 4.0 / Chromium 141 SwiftShader / 45-degree visual stop; exact MLD limits unverified.', font=small, fill='white')
sheet.save(args.output / '15-four-airbrakes-in-game.jpg', quality=88)

stops = Image.new('RGB', (1280, 980), '#111c28')
draw = ImageDraw.Draw(stops)
draw.text((15, 15), 'MiG-23MLD / full native commands / closer tail-root and rudder inspection', font=font, fill='white')
for i, (name, label) in enumerate([
    ('pitch-stop-up', 'Pitch +1: native slab outputs approximately +25 degrees'),
    ('pitch-stop-down', 'Pitch -1: native slab outputs approximately -25 degrees'),
    ('rudder-stop-right', 'Yaw +1: native rudder approximately +30 degrees'),
    ('rudder-stop-left', 'Yaw -1: native rudder approximately -30 degrees'),
]):
    image = Image.open(args.captures / ('mig23-tail-' + name + '.png')).convert('RGB')
    image.thumbnail((620, 410), Image.Resampling.LANCZOS)
    x, y = 10 + (i % 2) * 640, 60 + (i // 2) * 440
    stops.paste(image, (x, y + 25))
    draw.text((x + 5, y), label, font=small, fill='white')
draw.text((15, 950), 'Tim Samedov model: CC BY 4.0 / Chromium 141 SwiftShader / source-fitted visual shaft positions.', font=small, fill='white')
stops.save(args.output / '14-tail-native-stops.jpg', quality=88)
