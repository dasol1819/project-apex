"""Read the polygon/UV subset used by the pinned AC3D Flanker model.

SPDX-License-Identifier: GPL-2.0-only
"""
import shlex
from pathlib import Path


def read_ac(path):
    lines = Path(path).read_text().splitlines()
    objects, current, i = [], None, 0
    while i < len(lines):
        s = lines[i].strip()
        i += 1
        if s.startswith('OBJECT '):
            current = {'kind': s.split()[1], 'name': 'unnamed', 'vertices': [], 'faces': [], 'texture': None}
            objects.append(current)
        elif s.startswith('name '):
            current['name'] = shlex.split(s)[1]
        elif s.startswith('texture '):
            current['texture'] = shlex.split(s)[1]
        elif s.startswith('numvert '):
            n = int(s.split()[1])
            current['vertices'] = [list(map(float, l.split())) for l in lines[i:i+n]]
            i += n
        elif s.startswith('numsurf '):
            for _ in range(int(s.split()[1])):
                flags = int(lines[i].split()[1], 0)
                material = int(lines[i+1].split()[1])
                n = int(lines[i+2].split()[1])
                i += 3
                refs = [list(map(float, l.split())) for l in lines[i:i+n]]
                i += n
                current['faces'].append({'flags': flags, 'material': material, 'refs': refs})
    return [o for o in objects if o['vertices']]
