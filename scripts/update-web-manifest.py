"""Record checksums of the readable web overrides; leave the payload untouched."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parent.parent / 'web'
files = {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
         for p in sorted(root.rglob('*')) if p.is_file() and p.name != 'manifest.json'}
(root / 'manifest.json').write_text(json.dumps({'version': 1, 'files': files}, indent=2) + '\n')
print(f'Recorded {len(files)} web overrides')
