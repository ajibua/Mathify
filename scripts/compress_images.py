#!/usr/bin/env python3
"""Create optimized WebP copies of PNG and JPEG files under a public directory."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def convert_image(source: Path, quality: int, overwrite: bool) -> Path | None:
    target = source.with_suffix('.webp')
    if target.exists() and not overwrite:
        return None

    with Image.open(source) as image:
        save_kwargs = {'format': 'WEBP', 'quality': quality, 'method': 6}
        if image.mode in {'RGBA', 'LA'}:
            save_kwargs['lossless'] = False
        image.save(target, **save_kwargs)
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', nargs='?', type=Path, default=Path('frontend/public'))
    parser.add_argument('--quality', type=int, default=82)
    parser.add_argument('--overwrite', action='store_true')
    args = parser.parse_args()

    if not 1 <= args.quality <= 100:
        parser.error('--quality must be between 1 and 100')
    if not args.directory.is_dir():
        parser.error(f'Image directory does not exist: {args.directory}')

    converted = 0
    for source in sorted(args.directory.rglob('*')):
        if source.suffix.lower() not in {'.png', '.jpg', '.jpeg'}:
            continue
        if convert_image(source, args.quality, args.overwrite):
            converted += 1
            print(f'Created {source.with_suffix(".webp")}')

    print(f'Converted {converted} image(s).')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())