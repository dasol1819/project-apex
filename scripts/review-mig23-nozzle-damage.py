"""Compose actual native nozzle loss captures; do not alter aircraft geometry."""
import argparse
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--before',type=Path,required=True);p.add_argument('--after',type=Path,required=True);p.add_argument('--output',type=Path,required=True)
a=p.parse_args();out=Image.new('RGB',(1800,1400),'#111c28');d=ImageDraw.Draw(out);font=ImageFont.truetype('DejaVuSans.ttf',22);small=ImageFont.truetype('DejaVuSans.ttf',17)
d.text((12,12),'MiG-23MLD / source nozzle loss / actual native +0.5 s body and frozen aperture',font=font,fill='white')
for i,(v,label) in enumerate([('0','dry / closed visual command'),('0.5','half opening'),('1','wet / open visual command')]):
 y=56+i*430
 for x,folder,name,caption in [(10,a.before,'nozzle-lost-'+v,'Before: health 0; skin remains / empty debris'),(610,a.after,'nozzle-lost-'+v,'After: source petals removed; plume off'),(1210,a.after,'nozzle-piece-'+v,'Native body +0.5 s / original UVs / 288 triangles')]:
  im=Image.open(folder/(name+'.png')).convert('RGB');im.thumbnail((580,382));out.paste(im,(x,y+28));d.text((x,y),label,font=small,fill='white');d.text((x,y+412),caption,font=small,fill='white')
d.text((12,1355),'Chromium 141 SwiftShader. Model: Tim Samedov / CC BY 4.0. Camera follows native debris; no manual relocation.',font=small,fill='white')
d.text((12,1377),'The visual aperture/morph is provisional. This image does not certify R-35 hardware dimensions, stops or active-plume fidelity.',font=small,fill='white')
a.output.parent.mkdir(parents=True,exist_ok=True);out.save(a.output,quality=89)
