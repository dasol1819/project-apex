from pathlib import Path
import base64,hashlib,io,json,shutil,zipfile
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
source=Path(__file__).resolve().parent.parent
manifest=source/'web/manifest.json'
assert not (source/'web').is_dir() or manifest.is_file(), 'Missing web override manifest'
if manifest.is_file():
 overrides=json.loads(manifest.read_text())
 assert overrides['version']==1, 'Unsupported web override manifest'
 expected=overrides['files']
 actual={p.relative_to(source/'web').as_posix() for p in (source/'web').rglob('*') if p.is_file() and p.name!='manifest.json'}
 assert set(expected)==actual, 'Missing or unlisted web override'
 for name,digest in expected.items():
  rel=Path(name)
  assert not rel.is_absolute() and '..' not in rel.parts and rel.suffix in {'.js','.css','.html'}, 'Unsafe web override path'
  file=source/'web'/rel
  assert not file.is_symlink() and hashlib.sha256(file.read_bytes()).hexdigest()==digest, 'Web override checksum mismatch: '+name
  target=Path('public')/rel
  target.parent.mkdir(parents=True,exist_ok=True)
  shutil.copyfile(file,target)
print('Verified and restored Project Apex')
