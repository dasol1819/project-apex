"""Compare actual game captures from the multi-instance resource regression.
Model: Tim Samedov (citizensnip), MiG-23MLD, CC BY 4.0.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--baseline', type=Path, required=True)
parser.add_argument('--shared', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
before = json.loads((args.baseline / 'resources.json').read_text())
after = json.loads((args.shared / 'resources.json').read_text())
canvas = Image.new('RGB', (1440, 1280), '#111c28')
draw = ImageDraw.Draw(canvas)
font = ImageFont.truetype('DejaVuSans.ttf', 22)
small = ImageFont.truetype('DejaVuSans.ttf', 17)
draw.text((15, 15), 'MiG-23MLD / full-resolution source sharing / actual game renderer', font=font, fill='white')
for column, (folder, report, label) in enumerate([(args.baseline, before, 'Before'), (args.shared, after, 'Shared source')]):
    for row, (name, title) in enumerate([('one', 'One aircraft'), ('two', 'Two aircraft'), ('remaining', 'After removing the second aircraft')]):
        image = Image.open(folder / (name + '.png')).convert('RGB').crop((300, 330, 970, 620))
        image = image.resize((700, 303), Image.Resampling.LANCZOS)
        x, y = 10 + column * 720, 70 + row * 380
        canvas.paste(image, (x, y + 30))
        draw.text((x + 4, y), label + ' / ' + title, font=font, fill='white')
        stats = report[name]
        caption = f"Source handles: {stats['handles']} / RGBA8 estimate: {stats['estimatedRGBA8Bytes']/1048576:.1f} MiB / renderer textures: {stats['rendererTextures']}"
        draw.text((x + 4, y + 340), caption, font=small, fill='white')
draw.text((15, 1220), 'Chromium 141 / SwiftShader / identical source GLB, original maps and model detail retained. Lighting/background vary between runs.', font=small, fill='white')
draw.text((15, 1250), 'Tim Samedov model: CC BY 4.0. Handles observed; memory estimated. Physical GPU allocation/FPS and AI combat are unmeasured.', font=small, fill='white')
args.output.parent.mkdir(parents=True, exist_ok=True)
canvas.save(args.output, quality=89)
