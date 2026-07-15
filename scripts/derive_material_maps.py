#!/usr/bin/env python3

from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Derive seamless normal and roughness maps from a material albedo.")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--normal", required=True, type=Path)
    parser.add_argument("--roughness", required=True, type=Path)
    parser.add_argument("--strength", type=float, default=1.0)
    parser.add_argument("--roughness-min", type=int, default=168)
    parser.add_argument("--roughness-max", type=int, default=242)
    return parser.parse_args()


def derive_normal(gray: Image.Image, strength: float) -> Image.Image:
    softened = gray.filter(ImageFilter.GaussianBlur(radius=0.7))
    sobel_x = softened.filter(
        ImageFilter.Kernel((3, 3), (-1, 0, 1, -2, 0, 2, -1, 0, 1), scale=1, offset=128)
    )
    sobel_y = softened.filter(
        ImageFilter.Kernel((3, 3), (-1, -2, -1, 0, 0, 0, 1, 2, 1), scale=1, offset=128)
    )
    x_pixels = sobel_x.load()
    y_pixels = sobel_y.load()
    normal = Image.new("RGB", gray.size)
    normal_pixels = normal.load()
    scale = max(0.05, strength) / 127
    for y in range(gray.height):
        for x in range(gray.width):
            nx = (x_pixels[x, y] - 128) * scale
            ny = -(y_pixels[x, y] - 128) * scale
            nz = 1.0
            length = math.sqrt(nx * nx + ny * ny + nz * nz)
            normal_pixels[x, y] = (
                round((nx / length * 0.5 + 0.5) * 255),
                round((ny / length * 0.5 + 0.5) * 255),
                round((nz / length * 0.5 + 0.5) * 255),
            )
    return normal


def derive_roughness(gray: Image.Image, minimum: int, maximum: int) -> Image.Image:
    detailed = ImageEnhance.Contrast(gray.filter(ImageFilter.GaussianBlur(radius=1.2))).enhance(0.72)
    inverted = ImageOps.invert(detailed)
    return inverted.point(lambda value: round(minimum + (value / 255) * (maximum - minimum)))


def main() -> int:
    args = parse_args()
    source = Image.open(args.input).convert("RGB")
    gray = ImageOps.grayscale(source)
    normal = derive_normal(gray, args.strength)
    roughness = derive_roughness(
        gray,
        max(0, min(255, args.roughness_min)),
        max(0, min(255, args.roughness_max)),
    )
    args.normal.parent.mkdir(parents=True, exist_ok=True)
    args.roughness.parent.mkdir(parents=True, exist_ok=True)
    normal.save(args.normal, format="WEBP", quality=94, method=6)
    roughness.save(args.roughness, format="WEBP", quality=94, method=6)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
