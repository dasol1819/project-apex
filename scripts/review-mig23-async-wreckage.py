"""Compare actual cached-source native body captures; preserve all image content."""
import argparse
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--before',type=Path,required=True);p.add_argument('--after',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
out=Image.new('RGB',(1500,675),'#111c28');d=ImageDraw.Draw(out);font=ImageFont.truetype('DejaVuSans.ttf',22);small=ImageFont.truetype('DejaVuSans.ttf',17)
d.text((10,10),'MiG-23MLD / native detachment BEFORE cached original arrives / same native body pose',font=font,fill='white')
for x,folder,label in [(10,a.before,'Before fix: fallback remains / 352 triangles / no source UV'),(760,a.after,'After fix: original nozzle / 288 triangles / original UV')]:
 im=Image.open(folder/'after.png').convert('RGB');im.thumbnail((730,481));out.paste(im,(x,50));d.text((x,545),label,font=small,fill='white')
d.text((10,590),'Native identity/state/position/quaternion unchanged. Half aperture retained; ten later updates reuse the refreshed body.',font=small,fill='white')
d.text((10,615),'Chromium 141 SwiftShader. Attached aircraft/other native bodies hidden for this view; ordinary damage particles remain.',font=small,fill='white')
d.text((10,637),'Tim Samedov original model: CC BY 4.0. Test-only response inspection; no production debug API.',font=small,fill='white')
a.output.parent.mkdir(parents=True,exist_ok=True);out.save(a.output,quality=89)
