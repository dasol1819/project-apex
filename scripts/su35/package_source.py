"""Package the editable asset and browser model source for distribution.

Run after restoring the web runtime:
python3 scripts/su35/package_source.py /path/to/restored/public
SPDX-License-Identifier: GPL-2.0-only
"""
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
runtime = Path(sys.argv[1]).resolve()
entries = {}
for folder in ['assets/su35-source', 'scripts/su35']:
    for p in sorted((ROOT / folder).rglob('*')):
        if p.is_file() and p.suffix in ['.ac', '.png', '.blend', '.md', '.py'] or p.is_file() and p.name == 'COPYING':
            entries[str(p.relative_to(ROOT))] = p

visited = set()


def module(name):
    name = str(Path(name))
    if name in visited:
        return
    visited.add(name)
    override = ROOT / 'web' / name
    source = override if override.is_file() else runtime / name
    assert source.is_file(), source
    entries['web/' + name] = source
    for dependency in re.findall(r'''(?:from\s*|import\s*)['"](\.[^'"]+)['"]''', source.read_text()):
        dep = dependency.split('?')[0]
        module(str((Path(name).parent / dep)))


for name in ['su35-model.js', 'su35-studio.js', 'su35-asset.js']:
    module(name)
for name in ['su35.html', 'su35-studio.css']:
    entries['web/' + name] = ROOT / 'web' / name

out = ROOT / 'web/assets/su35/source.zip'
with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, source in sorted(entries.items()):
        info = zipfile.ZipInfo(name, date_time=(2026, 10, 30, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, source.read_bytes())
print(f'Packaged {len(entries)} source files ({out.stat().st_size:,} bytes)')
