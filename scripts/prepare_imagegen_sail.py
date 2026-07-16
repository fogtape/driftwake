#!/usr/bin/env python3

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ImageStat

from derive_material_maps import derive_normal, derive_roughness


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare an ImageGen sailcloth source for PBR rendering.")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--albedo", required=True, type=Path)
    parser.add_argument("--normal", required=True, type=Path)
    parser.add_argument("--roughness", required=True, type=Path)
    parser.add_argument("--size", type=int, default=1024)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.size < 512 or args.size % 64 != 0:
        raise SystemExit("--size must be at least 512 and divisible by 64")

    source = Image.open(args.input).convert("RGB")
    side = min(source.size)
    left = (source.width - side) // 2
    top = (source.height - side) // 2
    albedo = source.crop((left, top, left + side, top + side)).resize(
        (args.size, args.size), Image.Resampling.LANCZOS
    )
    albedo = ImageEnhance.Color(albedo).enhance(0.9)
    albedo = ImageEnhance.Contrast(albedo).enhance(0.96)

    luminance = ImageStat.Stat(ImageOps.grayscale(albedo))
    mean = luminance.mean[0]
    spread = luminance.stddev[0]
    if not 118 <= mean <= 224 or spread < 12:
        raise SystemExit(f"sailcloth failed luminance validation: mean={mean:.1f}, spread={spread:.1f}")

    gray = ImageOps.grayscale(albedo)
    normal = derive_normal(gray.filter(ImageFilter.GaussianBlur(radius=0.35)), 0.78)
    roughness = derive_roughness(gray, 190, 247)

    for path in (args.albedo, args.normal, args.roughness):
        path.parent.mkdir(parents=True, exist_ok=True)
    albedo.save(args.albedo, format="WEBP", quality=95, method=6)
    normal.save(args.normal, format="WEBP", quality=94, method=6)
    roughness.save(args.roughness, format="WEBP", quality=94, method=6)
    print(f"prepared {args.size}x{args.size}; luminance mean={mean:.1f}, spread={spread:.1f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
