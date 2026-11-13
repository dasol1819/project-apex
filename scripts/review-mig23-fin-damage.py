"""Compose attributable original game captures; no private photo pixels included."""
import argparse
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--captures',type=Path,required=True);p.add_argument('--references',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('DejaVuSans.ttf',18)
def sheet(images,filename):
 board=Image.new('RGB',(1440,1040),'#111c28');d=ImageDraw.Draw(board)
 for i,(path,title) in enumerate(images):
  image=Image.open(path).convert('RGB');image.thumbnail((710,450));x=10+(i%2)*720;y=10+(i//2)*490;d.text((x,y),title,font=font,fill='white');board.paste(image,(x+(710-image.width)//2,y+28))
 d.text((10,1000),'2026-11-13 Seoul / Chromium141 SwiftShader / Tim Samedov model CC BY 4.0 / hardware FPS unmeasured',font=font,fill='white');board.save(a.output/filename,quality=89)
sheet([(a.captures/'fin-intact.png','Original fixed fin / rudder intact'),(a.captures/'fin-lost.png','Part 5 lost / no floating lower fairing'),(a.captures/'fin-piece.png','972 original triangles / native moving body +0.5s'),(a.captures/'damage-20.png','Rudder-only loss / fixed fin remains')],'40-original-fin-native-damage.jpg')
sheet([(a.references/'fin-port-tip.png','Port fin tip / camera for private Keip49 overlap'),(a.references/'fin-starboard-tip.png','Opposite fin tip / original details still unapproved'),(a.references/'intake-splitter.png','Current intake / camera for private Keip28 overlap'),(a.references/'fin-root.png','Aft root / skin and metal-band inspection')],'44-fin-reference-cameras.jpg')
