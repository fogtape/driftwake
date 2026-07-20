#!/usr/bin/env python3

from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

from derive_material_maps import derive_normal, derive_roughness


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare a centered ImageGen eye decal for PBR rendering.")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--albedo", required=True, type=Path)
    parser.add_argument("--normal", required=True, type=Path)
    parser.add_argument("--roughness", required=True, type=Path)
    parser.add_argument("--size", type=int, default=1024)
    return parser.parse_args()


def radial_mean(gray: Image.Image, inner: float, outer: float) -> float:
    pixels = gray.load()
    center_x = (gray.width - 1) / 2
    center_y = (gray.height - 1) / 2
    radius_scale = min(gray.size) / 2
    total = 0
    count = 0
    for y in range(gray.height):
        for x in range(gray.width):
            radius = math.hypot(x - center_x, y - center_y) / radius_scale
            if inner <= radius < outer:
                total += pixels[x, y]
                count += 1
    return total / max(1, count)


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
    gray = ImageOps.grayscale(albedo)
    pupil = radial_mean(gray, 0, 0.16)
    iris = radial_mean(gray, 0.25, 0.7)
    edge = radial_mean(gray, 0.88, 1.0)
    if iris < pupil + 18 or iris < edge + 18:
        raise SystemExit(
            f"eye decal failed radial contrast: pupil={pupil:.1f}, iris={iris:.1f}, edge={edge:.1f}"
        )

    normal = derive_normal(gray.filter(ImageFilter.GaussianBlur(radius=0.6)), 0.28)
    roughness = derive_roughness(gray.filter(ImageFilter.GaussianBlur(radius=0.8)), 58, 138)
    for path in (args.albedo, args.normal, args.roughness):
        path.parent.mkdir(parents=True, exist_ok=True)
    albedo.save(args.albedo, format="WEBP", quality=95, method=6)
    normal.save(args.normal, format="WEBP", quality=94, method=6)
    roughness.save(args.roughness, format="WEBP", quality=94, method=6)
    print(f"prepared {args.size}x{args.size}; radial pupil={pupil:.1f}, iris={iris:.1f}, edge={edge:.1f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
