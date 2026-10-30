"""Extract the checksum-verified original flight module without web overrides."""
import base64
import hashlib
import io
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
parts = sorted((root / '.deployment').glob('web-*.b64'))
assert len(parts) == 57
data = b''.join(base64.b64decode(p.read_text(), validate=True) for p in parts)
assert hashlib.sha256(data).hexdigest() == 'cc1140370a7edfede36d14866280ea619d0158be096747416611e95f56ca89bd'
with zipfile.ZipFile(io.BytesIO(data)) as archive:
    Path(sys.argv[1]).write_bytes(archive.read('flight.wasm'))
