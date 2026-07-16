#!/usr/bin/env python3

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ImageStat

from derive_material_maps import derive_normal, derive_roughness
from prepare_imagegen_material import internal_delta, make_periodic, periodic_blur, seam_delta


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare an ImageGen growing-medium source for seamless PBR use.")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--albedo", required=True, type=Path)
    parser.add_argument("--normal", required=True, type=Path)
    parser.add_argument("--roughness", required=True, type=Path)
    parser.add_argument("--size", type=int, default=1024)
    parser.add_argument("--seam-width", type=int, default=164)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.size < 512 or args.size % 64 != 0:
        raise SystemExit("--size must be at least 512 and divisible by 64")

    source = Image.open(args.input).convert("RGB")
    side = min(source.size)
    left = (source.width - side) // 2
    top = (source.height - side) // 2
    source = source.crop((left, top, left + side, top + side)).resize(
        (args.size, args.size), Image.Resampling.LANCZOS
    )
    source = ImageEnhance.Color(source).enhance(0.82)
    source = ImageEnhance.Contrast(source).enhance(0.91)
    source = source.filter(ImageFilter.GaussianBlur(radius=0.32))
    albedo = make_periodic(source, args.seam_width)

    horizontal, vertical = seam_delta(albedo)
    internal_horizontal, internal_vertical = internal_delta(albedo)
    horizontal_ratio = horizontal / max(0.01, internal_horizontal)
    vertical_ratio = vertical / max(0.01, internal_vertical)
    luminance = ImageStat.Stat(ImageOps.grayscale(albedo))
    mean = luminance.mean[0]
    spread = luminance.stddev[0]
    if not 38 <= mean <= 132 or spread < 24:
        raise SystemExit(f"soil failed luminance validation: mean={mean:.1f}, spread={spread:.1f}")
    if horizontal > 24 or vertical > 24 or horizontal_ratio > 1.35 or vertical_ratio > 1.35:
        raise SystemExit(
            "soil failed seam validation: "
            f"x={horizontal:.2f}/{horizontal_ratio:.2f}x, y={vertical:.2f}/{vertical_ratio:.2f}x"
        )

    gray = periodic_blur(ImageOps.grayscale(albedo), 0.72)
    normal = derive_normal(gray, 0.92)
    roughness = derive_roughness(periodic_blur(gray, 1.25), 204, 248)
    for path in (args.albedo, args.normal, args.roughness):
        path.parent.mkdir(parents=True, exist_ok=True)
    albedo.save(args.albedo, format="WEBP", quality=95, method=6)
    normal.save(args.normal, format="WEBP", quality=94, method=6)
    roughness.save(args.roughness, format="WEBP", quality=94, method=6)
    print(
        f"prepared {args.size}x{args.size}; luminance mean={mean:.1f}, spread={spread:.1f}; seam "
        f"x={horizontal:.2f}/{horizontal_ratio:.2f}x, y={vertical:.2f}/{vertical_ratio:.2f}x"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
