"""Private photo/render registration with a single global similarity transform.

Requires a locally obtained reference. This tool does not grant redistribution
rights; publish numeric recipes/observations, not unlicensed reference pixels.
"""
import argparse,json
from pathlib import Path
from PIL import Image,ImageChops
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--photo',type=Path,required=True);p.add_argument('--capture',type=Path,required=True);p.add_argument('--background',type=Path,required=True);p.add_argument('--recipe',type=Path,required=True);p.add_argument('--output',type=Path,required=True)
a=p.parse_args();recipe=json.loads(a.recipe.read_text());registration=recipe['privateOverlay']
photo=Image.open(a.photo).convert('RGBA');render=Image.open(a.capture).convert('RGB');background=Image.open(a.background).convert('RGB');delta=ImageChops.difference(render,background).split();mask=ImageChops.lighter(ImageChops.lighter(delta[0],delta[1]),delta[2]).point(lambda v:255 if v>8 else 0);render.putalpha(mask)
p0,p1=map(lambda xy:complex(*xy),registration['renderAnchors']);q0,q1=map(lambda xy:complex(*xy),registration['photoAnchors']);c=(q1-q0)/(p1-p0);t=q0-c*p0;den=abs(c)**2
inverse=(c.real/den,c.imag/den,(-c.real*t.real-c.imag*t.imag)/den,-c.imag/den,c.real/den,(c.imag*t.real-c.real*t.imag)/den)
registered=render.transform(photo.size,Image.Transform.AFFINE,inverse,Image.Resampling.BICUBIC);registered.putalpha(registered.getchannel('A').point(lambda v:round(v*registration['opacity'])));a.output.parent.mkdir(parents=True,exist_ok=True);Image.alpha_composite(photo,registered).convert('RGB').save(a.output,quality=91)
print(json.dumps(dict(scale=abs(c),rotationRadians=__import__('cmath').phase(c),translation=[t.real,t.imag],opacity=registration['opacity'],scope='whole frame registration; no individual part warp; private reference pixels')))
