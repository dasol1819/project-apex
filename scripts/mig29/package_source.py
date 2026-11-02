"""Reproducible GPL source distribution with complete editable dependencies."""

from pathlib import Path
import hashlib, json, re, zipfile, sys

ROOT = Path(__file__).resolve().parents[2]
runtime = Path(sys.argv[1])
entries = {}
visited = set()
for folder in ["assets/mig29-source", "assets/mig29-combat", "scripts/mig29"]:
    for p in sorted((ROOT / folder).rglob("*")):
        if (
            p.is_file()
            and p.suffix not in [".pyc", ".blend1"]
            and "__pycache__" not in p.parts
        ):
            entries[str(p.relative_to(ROOT))] = p
for p in sorted((ROOT / "docs/mig29-surface-review").glob("*")):
    if p.is_file():
        entries[str(p.relative_to(ROOT))] = p
entries["scripts/su35/ac_reader.py"] = ROOT / "scripts/su35/ac_reader.py"
for name in [
    "scripts/airframe-surface/build_surface.py",
    "scripts/airframe-surface/bake_surface.cpp",
    "web/surface-transcoder.worker.js",
    "web/vendor/basis/basis_transcoder.js",
    "web/vendor/basis/basis_transcoder.wasm",
    "web/vendor/basis/Apache-2.0.txt",
    "web/vendor/basis/THREE-LICENSE.txt",
    "web/vendor/basis/README.txt",
    "web/assets/mig29/surface.json",
    "web/assets/mig29/surface-uv.json",
    "tests/mig29-surface-data.mjs",
    "tests/mig29-surface-browser.py",
]:
    entries[name] = ROOT / name
entries["scripts/native/build-mig29.mjs"] = ROOT / "scripts/native/build-mig29.mjs"


def module(name):
    name = str(Path(name))
    if name in visited:
        return
    visited.add(name)
    source = ROOT / "web" / name
    if not source.exists():
        source = runtime / name
    assert source.is_file(), source
    entries["web/" + name] = source
    for dep in re.findall(
        r"""(?:from\s*|import\s*)['"](\.[^'"]+)['"]""", source.read_text()
    ):
        module(str(Path(name).parent / dep.split("?")[0]))


for name in [
    "mig29-model.js",
    "mig29-studio.js",
    "mig29-asset.js",
    "mig29-combat-model.js",
]:
    module(name)
entries["web/mig29.html"] = ROOT / "web/mig29.html"
entries["web/su35-studio.css"] = ROOT / "web/su35-studio.css"
checksums = {
    n: hashlib.sha256(p.read_bytes()).hexdigest()
    for n, p in entries.items()
    if n.startswith("assets/mig29-source/") and not n.endswith("SOURCE.json")
}
source = ROOT / "assets/mig29-source/SOURCE.json"
source.write_text(
    json.dumps(
        {
            "repository": "https://github.com/FGMEMBERS/MiG-29",
            "revision": "646e9f9d6b958773e69cbde74602642c91fcfcaf",
            "authors": ["Detlef Faber", "Gary R. Neely"],
            "license": "GPL-2.0-only",
            "sha256": checksums,
        },
        indent=2,
    )
    + "\n"
)
entries["assets/mig29-source/SOURCE.json"] = source
with zipfile.ZipFile(
    ROOT / "web/assets/mig29/source.zip",
    "w",
    compression=zipfile.ZIP_DEFLATED,
    compresslevel=9,
) as archive:
    for name, p in sorted(entries.items()):
        info = zipfile.ZipInfo(name, date_time=(2026, 11, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, p.read_bytes())
print("Packaged", len(entries), "source files")
