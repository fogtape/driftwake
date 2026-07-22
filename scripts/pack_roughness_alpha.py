#!/usr/bin/env python3

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser(description="Pack an albedo RGB image and roughness map into RGBA WebP.")
    parser.add_argument("--albedo", required=True, type=Path)
    parser.add_argument("--roughness", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--quality", type=int, default=92)
    args = parser.parse_args()

    with Image.open(args.albedo) as source:
        albedo = source.convert("RGB")
    with Image.open(args.roughness) as source:
        roughness = source.convert("L")
    if albedo.size != roughness.size:
        raise SystemExit(f"image sizes differ: albedo={albedo.size}, roughness={roughness.size}")

    red, green, blue = albedo.split()
    packed = Image.merge("RGBA", (red, green, blue, roughness))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    packed.save(args.output, "WEBP", quality=args.quality, method=6, exact=True)
    print(f"packed {albedo.width}x{albedo.height} RGB+A roughness -> {args.output}")


if __name__ == "__main__":
    main()
