#!/usr/bin/env python3

from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter, ImageOps

from derive_material_maps import derive_normal, derive_roughness


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare an ImageGen material for seamless PBR use.")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--albedo", required=True, type=Path)
    parser.add_argument("--normal", required=True, type=Path)
    parser.add_argument("--roughness", required=True, type=Path)
    parser.add_argument("--size", type=int, default=1024)
    parser.add_argument("--seam-width", type=int, default=150)
    parser.add_argument("--normal-strength", type=float, default=1.08)
    parser.add_argument("--roughness-min", type=int, default=174)
    parser.add_argument("--roughness-max", type=int, default=238)
    return parser.parse_args()


def make_periodic(image: Image.Image, seam_width: int) -> Image.Image:
    width, height = image.size
    seam_width = max(8, min(seam_width, width // 4, height // 4))
    wrapped = ImageChops.offset(image, width // 2, height // 2)
    mask = Image.new("L", image.size)
    mask_pixels = mask.load()
    for y in range(height):
        width_wobble = 1 + math.sin(y * 0.027) * 0.16 + math.sin(y * 0.071 + 1.2) * 0.08
        for x in range(width):
            height_wobble = 1 + math.sin(x * 0.025 + 0.7) * 0.15 + math.sin(x * 0.063) * 0.07
            vertical = max(0.0, 1 - abs(x - width / 2) / (seam_width * width_wobble))
            horizontal = max(0.0, 1 - abs(y - height / 2) / (seam_width * height_wobble))
            blend = max(vertical * vertical * (3 - 2 * vertical), horizontal * horizontal * (3 - 2 * horizontal))
            mask_pixels[x, y] = round(blend * 255)
    return Image.composite(image, wrapped, mask)


def periodic_blur(image: Image.Image, radius: float) -> Image.Image:
    width, height = image.size
    tiled = Image.new(image.mode, (width * 3, height * 3))
    for tile_y in range(3):
        for tile_x in range(3):
            tiled.paste(image, (tile_x * width, tile_y * height))
    blurred = tiled.filter(ImageFilter.GaussianBlur(radius=radius))
    return blurred.crop((width, height, width * 2, height * 2))


def seam_delta(image: Image.Image) -> tuple[float, float]:
    rgb = image.convert("RGB")
    left = rgb.crop((0, 0, 1, rgb.height))
    right = rgb.crop((rgb.width - 1, 0, rgb.width, rgb.height))
    top = rgb.crop((0, 0, rgb.width, 1))
    bottom = rgb.crop((0, rgb.height - 1, rgb.width, rgb.height))
    horizontal = sum(ImageChops.difference(left, right).convert("L").get_flattened_data()) / rgb.height
    vertical = sum(ImageChops.difference(top, bottom).convert("L").get_flattened_data()) / rgb.width
    return horizontal, vertical


def internal_delta(image: Image.Image) -> tuple[float, float]:
    rgb = image.convert("RGB")
    horizontal_samples = []
    vertical_samples = []
    for x in range(0, rgb.width - 1, max(1, rgb.width // 16)):
        first = rgb.crop((x, 0, x + 1, rgb.height))
        second = rgb.crop((x + 1, 0, x + 2, rgb.height))
        horizontal_samples.append(
            sum(ImageChops.difference(first, second).convert("L").get_flattened_data()) / rgb.height
        )
    for y in range(0, rgb.height - 1, max(1, rgb.height // 16)):
        first = rgb.crop((0, y, rgb.width, y + 1))
        second = rgb.crop((0, y + 1, rgb.width, y + 2))
        vertical_samples.append(
            sum(ImageChops.difference(first, second).convert("L").get_flattened_data()) / rgb.width
        )
    return (
        sum(horizontal_samples) / max(1, len(horizontal_samples)),
        sum(vertical_samples) / max(1, len(vertical_samples)),
    )


def main() -> int:
    args = parse_args()
    if args.size < 512 or args.size % 64 != 0:
        raise SystemExit("--size must be at least 512 and divisible by 64")

    source = Image.open(args.input).convert("RGB")
    if source.width != source.height:
        side = min(source.size)
        left = (source.width - side) // 2
        top = (source.height - side) // 2
        source = source.crop((left, top, left + side, top + side))
    source = source.resize((args.size, args.size), Image.Resampling.LANCZOS)
    albedo = make_periodic(source, args.seam_width)
    horizontal, vertical = seam_delta(albedo)
    internal_horizontal, internal_vertical = internal_delta(albedo)
    horizontal_ratio = horizontal / max(0.01, internal_horizontal)
    vertical_ratio = vertical / max(0.01, internal_vertical)
    if horizontal > 24 or vertical > 24 or horizontal_ratio > 1.35 or vertical_ratio > 1.35:
        raise SystemExit(
            "material failed seam validation: "
            f"x={horizontal:.2f}/{horizontal_ratio:.2f}x, y={vertical:.2f}/{vertical_ratio:.2f}x"
        )

    gray = periodic_blur(ImageOps.grayscale(albedo), 0.7)
    normal = derive_normal(gray, args.normal_strength)
    roughness = derive_roughness(periodic_blur(gray, 1.2), args.roughness_min, args.roughness_max)
    for path in (args.albedo, args.normal, args.roughness):
        path.parent.mkdir(parents=True, exist_ok=True)
    albedo.save(args.albedo, format="WEBP", quality=95, method=6)
    normal.save(args.normal, format="WEBP", quality=94, method=6)
    roughness.save(args.roughness, format="WEBP", quality=94, method=6)
    print(
        f"prepared {args.size}x{args.size}; seam "
        f"x={horizontal:.2f}/{horizontal_ratio:.2f}x, y={vertical:.2f}/{vertical_ratio:.2f}x"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
