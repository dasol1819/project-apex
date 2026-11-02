"""Build the mig29 packed PBR surface from the shared deterministic rasterizer.
SPDX-License-Identifier: GPL-2.0-only
"""

import subprocess
import runpy
import sys
from pathlib import Path

script = Path(__file__).resolve().parents[1] / "airframe-surface/build_surface.py"
subprocess.run(
    [
        "blender",
        "-b",
        "--factory-startup",
        "--threads",
        "4",
        "--python",
        str(Path(__file__).with_name("build_surface_uv.py")),
    ],
    check=True,
)
sys.argv = [str(script), "mig29", *sys.argv[1:]]
runpy.run_path(str(script), run_name="__main__")
