from pathlib import Path
import base64,hashlib,io,zipfile
parts=sorted(Path('.deployment').glob('web-*.b64'))
assert len(parts)==57, 'Missing game payload parts'
data=b''.join(base64.b64decode(p.read_text(),validate=True) for p in parts)
assert hashlib.sha256(data).hexdigest()=='cc1140370a7edfede36d14866280ea619d0158be096747416611e95f56ca89bd','Game payload checksum mismatch'
with zipfile.ZipFile(io.BytesIO(data)) as z:
 assert z.testzip() is None
 for name in z.namelist():
  assert not name.startswith('/') and '..' not in Path(name).parts
 z.extractall('public')
assert Path('public/index.html').is_file()
assert Path('public/flight.wasm').read_bytes()[:4]==b'\0asm'
assert Path('public/CNAME').read_text().strip()=='project-apex.kro.kr'
print('Verified and restored Project Apex')
