#!/usr/bin/env python3

from __future__ import annotations

import argparse
import math
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

from derive_material_maps import derive_normal, derive_roughness


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate Driftwake's deterministic seamless fallback materials.")
    parser.add_argument("--out-dir", type=Path, default=Path("public/assets/textures"))
    parser.add_argument("--size", type=int, default=1024)
    return parser.parse_args()


def periodic_noise(size: int, cells: int, seed: int) -> Image.Image:
    rng = random.Random(seed)
    base = Image.new("L", (cells, cells))
    base.putdata([rng.randrange(20, 236) for _ in range(cells * cells)])
    tiled = Image.new("L", (cells * 3, cells * 3))
    for tile_y in range(3):
        for tile_x in range(3):
            tiled.paste(base, (tile_x * cells, tile_y * cells))
    scaled = tiled.resize((size * 3, size * 3), Image.Resampling.BICUBIC)
    return scaled.crop((size, size, size * 2, size * 2))


def layered_noise(size: int, seed: int) -> Image.Image:
    broad = periodic_noise(size, 8, seed)
    medium = periodic_noise(size, 32, seed + 17)
    fine = periodic_noise(size, 128, seed + 31)
    return Image.blend(Image.blend(broad, medium, 0.42), fine, 0.18)


def wrapped_line(
    draw: ImageDraw.ImageDraw,
    points: tuple[tuple[float, float], tuple[float, float]],
    fill: tuple[int, int, int, int],
    width: int,
    size: int,
) -> None:
    for offset_x in (-size, 0, size):
        for offset_y in (-size, 0, size):
            shifted = tuple((x + offset_x, y + offset_y) for x, y in points)
            draw.line(shifted, fill=fill, width=width)


def generate_shark_skin(size: int) -> Image.Image:
    noise = layered_noise(size, 0x5A4C19)
    noise_pixels = noise.load()
    texture = Image.new("RGB", (size, size))
    pixels = texture.load()
    tau = math.pi * 2
    for y in range(size):
        for x in range(size):
            value = (noise_pixels[x, y] - 128) / 128
            denticle = math.sin(tau * (x * 17 + y * 31) / size) * 0.55
            cross = math.sin(tau * (x * 41 - y * 13) / size) * 0.2
            pixels[x, y] = (
                round(max(0, min(255, 91 + value * 17 + denticle * 3))),
                round(max(0, min(255, 119 + value * 21 + denticle * 4 + cross * 2))),
                round(max(0, min(255, 124 + value * 23 + denticle * 4))),
            )

    detail = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(detail)
    rng = random.Random(0xD37C1E)
    for _ in range(size // 2):
        x = rng.randrange(size)
        y = rng.randrange(size)
        length = rng.randrange(4, 15)
        tone = rng.choice(((208, 221, 216, 22), (40, 66, 70, 20), (161, 181, 179, 18)))
        wrapped_line(draw, ((x, y), (x + length, y + length * 0.28)), tone, rng.choice((1, 1, 2)), size)
    detail = detail.filter(ImageFilter.GaussianBlur(radius=0.22))
    texture = Image.alpha_composite(texture.convert("RGBA"), detail).convert("RGB")
    return ImageEnhance.Sharpness(texture).enhance(1.18)


def strand_points(
    constant: float,
    slope: float,
    canvas_size: int,
    phase: float,
    amplitude: float = 3.5,
    start_y: int = 0,
    end_y: int | None = None,
) -> list[tuple[float, float]]:
    final_y = canvas_size if end_y is None else end_y
    return [
        (
            constant + slope * y + math.sin(math.tau * y / 256 + phase) * amplitude,
            y,
        )
        for y in range(start_y, final_y + 1, 12)
    ]


def generate_woven_fiber(size: int) -> Image.Image:
    noise = layered_noise(size, 0xF1B3A)
    noise_pixels = noise.load()
    base = Image.new("RGB", (size, size))
    base_pixels = base.load()
    for y in range(size):
        for x in range(size):
            value = (noise_pixels[x, y] - 128) / 128
            base_pixels[x, y] = (
                round(max(0, min(255, 164 + value * 22))),
                round(max(0, min(255, 132 + value * 19))),
                round(max(0, min(255, 84 + value * 14))),
            )

    canvas_size = size * 3
    canvas = Image.new("RGB", (canvas_size, canvas_size))
    for tile_y in range(3):
        for tile_x in range(3):
            canvas.paste(base, (tile_x * size, tile_y * size))
    draw = ImageDraw.Draw(canvas)
    spacing = 64
    slope = (spacing * 3) / size
    start = -canvas_size
    end = canvas_size * 2

    for constant in range(start, end, spacing):
        variant = (constant // spacing) % 16
        phase = math.tau * variant / 16
        shade = ((variant * 11) % 13) - 6
        fiber = (183 + shade, 145 + shade, 88 + shade // 2)
        points = strand_points(constant, -slope, canvas_size, phase, 4.2)
        draw.line(points, fill=(71, 54, 36), width=28, joint="curve")
        draw.line(points, fill=fiber, width=22, joint="curve")
        for offset, tone in ((-6, (218, 181, 113)), (1, (171, 131, 77)), (6, (208, 168, 101))):
            detail = strand_points(constant + offset, -slope, canvas_size, phase, 4.2)
            draw.line(detail, fill=tone, width=2, joint="curve")

    for constant in range(start, end, spacing):
        variant = (constant // spacing) % 16
        phase = math.tau * ((variant * 5) % 16) / 16
        shade = ((variant * 7) % 11) - 5
        points = strand_points(constant, slope, canvas_size, phase, 3.2)
        draw.line(points, fill=(74, 56, 37), width=30, joint="curve")
        draw.line(points, fill=(195 + shade, 157 + shade, 96 + shade), width=23, joint="curve")
        draw.line(strand_points(constant - 6, slope, canvas_size, phase, 3.2), fill=(226, 190, 122), width=3)
        draw.line(strand_points(constant + 4, slope, canvas_size, phase, 3.2), fill=(166, 126, 74), width=2)

    for constant in range(start, end, spacing):
        variant = (constant // spacing) % 16
        phase = math.tau * variant / 16
        for segment_y in range(spacing, canvas_size, spacing * 2):
            segment = strand_points(
                constant,
                -slope,
                canvas_size,
                phase,
                4.2,
                segment_y - 5,
                segment_y + spacing + 5,
            )
            draw.line(segment, fill=(69, 52, 35), width=29, joint="curve")
            draw.line(segment, fill=(190, 153, 93), width=22, joint="curve")
            highlight = [(x - 6, y) for x, y in segment]
            draw.line(highlight, fill=(224, 187, 118), width=3, joint="curve")

    accents = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    accent_draw = ImageDraw.Draw(accents)
    for constant, color, phase_shift in (
        (size + 3 * spacing, (150, 80, 68, 150), 0.2),
        (size + 11 * spacing, (83, 124, 107, 135), 1.1),
    ):
        for segment_y in range(size // 4, canvas_size, size):
            segment = strand_points(
                constant,
                slope,
                canvas_size,
                phase_shift,
                2.4,
                segment_y,
                segment_y + 178,
            )
            accent_draw.line(segment, fill=color, width=4, joint="curve")
    canvas = Image.alpha_composite(canvas.convert("RGBA"), accents).convert("RGB")

    frays = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    fray_draw = ImageDraw.Draw(frays)
    rng = random.Random(0xF1B3A)
    for _ in range(size // 2):
        x = rng.randrange(size)
        y = rng.randrange(size)
        length = rng.randrange(5, 22)
        angle = rng.choice((-0.22, 0.18)) + rng.uniform(-0.08, 0.08)
        wrapped_line(
            fray_draw,
            ((x, y), (x + length, y + length * angle)),
            rng.choice(((235, 207, 148, 38), (99, 76, 49, 34), (190, 151, 91, 32))),
            1,
            size,
        )

    crop = canvas.crop((size, size, size * 2, size * 2))
    salt = periodic_noise(size, 256, 0x5A17)
    salt = salt.point(lambda value: 255 if value > 220 else 0).filter(ImageFilter.GaussianBlur(radius=0.35))
    pale = Image.new("RGB", (size, size), (212, 198, 157))
    crop = Image.composite(pale, crop, salt.point(lambda value: round(value * 0.12)))
    crop = Image.alpha_composite(crop.convert("RGBA"), frays).convert("RGB")
    return ImageEnhance.Sharpness(crop).enhance(1.3)


def seam_delta(image: Image.Image) -> tuple[float, float]:
    rgb = image.convert("RGB")
    left = rgb.crop((0, 0, 1, rgb.height))
    right = rgb.crop((rgb.width - 1, 0, rgb.width, rgb.height))
    top = rgb.crop((0, 0, rgb.width, 1))
    bottom = rgb.crop((0, rgb.height - 1, rgb.width, rgb.height))
    horizontal = sum(ImageChops.difference(left, right).convert("L").get_flattened_data()) / rgb.height
    vertical = sum(ImageChops.difference(top, bottom).convert("L").get_flattened_data()) / rgb.width
    return horizontal, vertical


def main() -> int:
    args = parse_args()
    if args.size < 512 or args.size % 64 != 0:
        raise SystemExit("--size must be at least 512 and divisible by 64")
    args.out_dir.mkdir(parents=True, exist_ok=True)
    outputs = {
        "shark-skin.webp": generate_shark_skin(args.size),
        "woven-palm-fiber.webp": generate_woven_fiber(args.size),
    }
    for filename, image in outputs.items():
        horizontal, vertical = seam_delta(image)
        if horizontal > 18 or vertical > 18:
            raise SystemExit(f"{filename} failed seam validation: x={horizontal:.2f}, y={vertical:.2f}")
        image.save(args.out_dir / filename, format="WEBP", quality=95, method=6)
        is_shark = filename.startswith("shark")
        gray = image.convert("L")
        normal = derive_normal(gray, 0.72 if is_shark else 1.35)
        roughness = derive_roughness(gray, 132 if is_shark else 196, 216 if is_shark else 250)
        stem = Path(filename).stem
        normal.save(args.out_dir / f"{stem}-normal.webp", format="WEBP", quality=94, method=6)
        roughness.save(args.out_dir / f"{stem}-roughness.webp", format="WEBP", quality=94, method=6)
        print(
            f"{filename}: {image.width}x{image.height}, seam x={horizontal:.2f}, y={vertical:.2f}; "
            "normal+roughness written"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
