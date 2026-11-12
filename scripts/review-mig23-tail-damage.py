"""Compose original actual-game tail-damage captures, preserving attribution."""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--baseline', type=Path, required=True)
p.add_argument('--current', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
a = p.parse_args()
a.output.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype('DejaVuSans.ttf', 22)
small = ImageFont.truetype('DejaVuSans.ttf', 17)
sheet = Image.new('RGB', (1800, 1550), '#111c28')
d = ImageDraw.Draw(sheet)
d.text((15, 15), 'MiG-23MLD / original source surfaces / actual native damage and free-body renderer', font=font, fill='white')
for row, (part, name, triangles) in enumerate([(3, 'Port stabilator', 64), (4, 'Starboard stabilator', 64), (20, 'Single rudder', 40)]):
    for column, (folder, suffix, label) in enumerate([
        (a.baseline, 'lost-', 'Before: health 0, source still attached'),
        (a.current, 'lost-', 'After: original source surface removed'),
        (a.current, 'wreck-', f'Native piece close-up +0.5 s / {triangles} triangles'),
    ]):
        image = Image.open(folder / f'mig23-{suffix}{part}.png').convert('RGB')
        image = image.crop((100, 10, 1260, 840)).resize((580, 415), Image.Resampling.LANCZOS)
        x, y = column * 600 + 10, row * 480 + 65
        d.text((x, y), name + ' / ' + str(part), font=font, fill='white')
        sheet.paste(image, (x, y + 28))
        d.text((x, y + 448), label, font=small, fill='white')
d.text((15, 1515), 'Chromium 141 SwiftShader. Tim Samedov model: CC BY 4.0. Camera follows each native piece; no manual debris displacement.', font=small, fill='white')
sheet.save(a.output / '23-native-tail-damage.jpg', quality=89)

sheet = Image.new('RGB', (1440, 1550), '#111c28')
d = ImageDraw.Draw(sheet)
d.text((15, 15), 'MiG-23MLD / intake and root inspection cameras / shape approval still pending', font=font, fill='white')
for row, (name, label) in enumerate([
    ('intake-starboard', 'Starboard intake: camera [6,0,-8], target [1.2,0,-3]'),
    ('intake-port', 'Port intake: camera [-6,0,-8], target [-1.2,0,-3]'),
    ('root-starboard', 'Starboard root/nozzle exterior: [5,1.2,10], target [.65,.6,6.2]'),
]):
    image = Image.open(a.current / ('mig23-' + name + '.png')).convert('RGB')
    image = image.crop((220, 100, 1150, 660)).resize((760, 458), Image.Resampling.LANCZOS)
    y = 65 + row * 480
    sheet.paste(image, (10, y + 25))
    d.text((10, y), label, font=small, fill='white')
    notes = {
        'intake-starboard': ['Compare Keip 28: separate splitter and', 'stand-off gap; matching roll/perspective', 'and full duct depth remain unresolved.'],
        'intake-port': ['Compare Keip 27: rounded outer lip and', 'splitter clearance. This camera does not', 'certify the hidden throat or inner ramp.'],
        'root-starboard': ['Compare Keip 45/47: metal exterior bands,', 'curved aft fairing and slab/root boundary.', 'Full travel/clearance and shape remain open.'],
    }[name]
    for i, text in enumerate(notes):
        d.text((790, y + 90 + i * 32), text, font=font, fill='white')
d.text((15, 1515), 'Tim Samedov model: CC BY 4.0. Keip copyrighted photographs were inspected privately and linked; not reproduced here.', font=small, fill='white')
sheet.save(a.output / '25-intake-root-inspection.jpg', quality=89)
