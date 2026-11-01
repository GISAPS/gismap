#!/usr/bin/env python3
"""Build a reproducible zip from the one canonical skill directory.

The version lives only in SKILL.md's frontmatter: this names the versioned ZIP
and stamps the version and ZIP link into the /skills/ page.
"""
from pathlib import Path
import re
import sys
import zipfile
from io import BytesIO
root = Path(__file__).resolve().parent.parent
skill = root / 'skills' / 'gismap'
out = root / 'skills' / 'gismap.zip'
page = root / 'skills' / 'index.html'
version = re.search(r'^version: "([^"]+)"$', (skill / 'SKILL.md').read_text(), re.M).group(1)
versioned = root / 'skills' / f'gismap-skill-{version}.zip'
stale_zips = [path for path in (root / 'skills').glob('gismap-skill-*.zip') if path != versioned]
page_text = page.read_text()
stamped = re.sub(r'(<span data-skill-version>)[^<]*(</span>)', rf'\g<1>{version}\g<2>', page_text)
stamped = re.sub(r'\./gismap-skill-[0-9.]+\.zip', f'./{versioned.name}', stamped)
buffer = BytesIO()
with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(skill.rglob('*')):
        if not path.is_file() or '__pycache__' in path.parts or path.suffix == '.pyc': continue
        info = zipfile.ZipInfo('gismap/' + path.relative_to(skill).as_posix(), (2020, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, path.read_bytes())
data = buffer.getvalue()
def entries(source):
    """Names and uncompressed contents: compressed bytes differ between zlib builds (macOS, Linux)."""
    with zipfile.ZipFile(source) as archive:
        return [(info.filename, archive.read(info)) for info in archive.infolist()]

if '--check' in sys.argv:
    if not out.exists() or not versioned.exists() or stale_zips or entries(out) != entries(BytesIO(data)) or entries(versioned) != entries(BytesIO(data)):
        print('Skill ZIP is missing or out of date', file=sys.stderr); sys.exit(1)
    if stamped != page_text:
        print('The /skills/ page has the wrong skill version', file=sys.stderr); sys.exit(1)
    print('Skill ZIP verified')
else:
    out.write_bytes(data)
    versioned.write_bytes(data)
    for path in stale_zips: path.unlink()
    page.write_text(stamped)
    print('Built', out, 'and', versioned)
