#!/usr/bin/env python3
"""Repack embedded GLB textures; preserve all geometry/accessor bytes and node hierarchy."""
import io, json, struct, hashlib, sys
from pathlib import Path
from PIL import Image

path=Path(sys.argv[1] if len(sys.argv)>1 else 'web/assets/mig23mld/Mig-23.glb')
data=path.read_bytes()
assert data[:4]==b'glTF' and struct.unpack_from('<II',data,4)==(2,len(data))
jsz,kind=struct.unpack_from('<II',data,12)
assert kind==0x4e4f534a
doc=json.loads(data[20:20+jsz])
pos=20+jsz
bsz,kind=struct.unpack_from('<II',data,pos)
assert kind==0x004e4942
binary=data[pos+8:pos+8+bsz]
assert doc['buffers'][0]['byteLength']<=len(binary)
image_views={im['bufferView']:(im,i) for i,im in enumerate(doc['images'])}
original_views=[dict(v) for v in doc['bufferViews']]
newbin=bytearray()
for idx,view in enumerate(doc['bufferViews']):
    original=original_views[idx]
    raw=binary[original.get('byteOffset',0):original.get('byteOffset',0)+original['byteLength']]
    if idx in image_views:
        im,_=image_views[idx]
        pic=Image.open(io.BytesIO(raw))
        if max(pic.size)>1536:
            pic.thumbnail((1536,1536),Image.Resampling.LANCZOS)
        out=io.BytesIO()
        if pic.mode in ('RGBA','LA') or 'transparency' in pic.info:
            pic.save(out,format='PNG',optimize=True)
            im['mimeType']='image/png'
        else:
            pic.convert('RGB').save(out,format='JPEG',quality=87,subsampling=0,optimize=True)
            im['mimeType']='image/jpeg'
        raw=out.getvalue()
    newbin.extend(b'\x00'*(-len(newbin)%4))
    view['byteOffset']=len(newbin)
    view['byteLength']=len(raw)
    newbin.extend(raw)
newbin.extend(b'\x00'*(-len(newbin)%4))
doc['buffers'][0]['byteLength']=len(newbin)
js=json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode()
js+=b' '*(-len(js)%4)
total=12+8+len(js)+8+len(newbin)
result=struct.pack('<4sII',b'glTF',2,total)+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(newbin),0x004e4942)+newbin
assert len(result)==total
# Every non-image bufferView is identical, including vertex data, normals, UVs and indices.
for i,view in enumerate(doc['bufferViews']):
    if i in image_views:continue
    before=original_views[i]
    left=binary[before.get('byteOffset',0):before.get('byteOffset',0)+before['byteLength']]
    right=newbin[view['byteOffset']:view['byteOffset']+view['byteLength']]
    assert left==right, f'Geometry bufferView changed: {i}'
assert len(doc['meshes'])>=100 and len(doc['images'])>0
path.write_bytes(result)
print('MiG-23GLB',len(data),'->',len(result),'bytes, sha256',hashlib.sha256(result).hexdigest())
