"""Build the su35 packed PBR surface from the shared deterministic rasterizer.
SPDX-License-Identifier: GPL-2.0-only
"""

import runpy
import sys
from pathlib import Path

script = Path(__file__).resolve().parents[1] / "airframe-surface/build_surface.py"
sys.argv = [str(script), "su35", *sys.argv[1:]]
runpy.run_path(str(script), run_name="__main__")
