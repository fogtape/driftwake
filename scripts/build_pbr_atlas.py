#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageChops


def wrapped_cell(image: Image.Image, cell_size: int, gutter: int) -> Image.Image:
    core_size = cell_size - gutter * 2
    core = image.resize((core_size, core_size), Image.Resampling.LANCZOS)
    tiled = Image.new(core.mode, (core_size * 3, core_size * 3))
    for y in range(3):
        for x in range(3):
            tiled.paste(core, (x * core_size, y * core_size))
    start = core_size - gutter
    return tiled.crop((start, start, start + cell_size, start + cell_size))


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a guttered PBR atlas with roughness packed into albedo alpha.")
    parser.add_argument("--input-dir", required=True, type=Path)
    parser.add_argument("--names", required=True, nargs="+")
    parser.add_argument("--albedo-output", required=True, type=Path)
    parser.add_argument("--normal-output", required=True, type=Path)
    parser.add_argument("--manifest-output", required=True, type=Path)
    parser.add_argument("--columns", type=int, default=4)
    parser.add_argument("--cell-size", type=int, default=1024)
    parser.add_argument("--gutter", type=int, default=32)
    parser.add_argument("--quality", type=int, default=92)
    args = parser.parse_args()

    if args.columns <= 0 or args.cell_size <= 0 or args.gutter < 0 or args.gutter * 2 >= args.cell_size:
        raise SystemExit("invalid atlas dimensions")
    rows = math.ceil(len(args.names) / args.columns)
    atlas_size = (args.columns * args.cell_size, rows * args.cell_size)
    packed_atlas = Image.new("RGBA", atlas_size, (128, 128, 128, 255))
    normal_atlas = Image.new("RGB", atlas_size, (128, 128, 255))
    regions: dict[str, object] = {}
    core_size = args.cell_size - args.gutter * 2

    for index, name in enumerate(args.names):
        albedo_path = args.input_dir / f"{name}.webp"
        normal_path = args.input_dir / f"{name}-normal.webp"
        roughness_path = args.input_dir / f"{name}-roughness.webp"
        with Image.open(albedo_path) as source:
            albedo = source.convert("RGB")
        with Image.open(normal_path) as source:
            normal = source.convert("RGB")
        with Image.open(roughness_path) as source:
            roughness = source.convert("L")
        if albedo.size != normal.size or albedo.size != roughness.size:
            raise SystemExit(f"source sizes differ for {name}")

        red, green, blue = albedo.split()
        packed = Image.merge("RGBA", (red, green, blue, roughness))
        column = index % args.columns
        row = index // args.columns
        origin = (column * args.cell_size, row * args.cell_size)
        packed_atlas.paste(wrapped_cell(packed, args.cell_size, args.gutter), origin)
        normal_atlas.paste(wrapped_cell(normal, args.cell_size, args.gutter), origin)

        uv_offset_x = (origin[0] + args.gutter) / atlas_size[0]
        uv_offset_y = (atlas_size[1] - origin[1] - args.cell_size + args.gutter) / atlas_size[1]
        regions[name] = {
            "index": index,
            "column": column,
            "row": row,
            "uvOffset": [uv_offset_x, uv_offset_y],
            "uvScale": [core_size / atlas_size[0], core_size / atlas_size[1]],
        }

    for path in [args.albedo_output, args.normal_output, args.manifest_output]:
        path.parent.mkdir(parents=True, exist_ok=True)
    packed_atlas.save(args.albedo_output, "WEBP", quality=args.quality, method=6, exact=True)
    normal_atlas.save(args.normal_output, "WEBP", quality=args.quality, method=6)
    manifest = {
        "version": 1,
        "atlasSize": list(atlas_size),
        "cellSize": args.cell_size,
        "gutter": args.gutter,
        "coreSize": core_size,
        "columns": args.columns,
        "rows": rows,
        "regions": regions,
    }
    args.manifest_output.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    with Image.open(args.albedo_output) as saved:
        alpha_diff = ImageChops.difference(saved.convert("RGBA").getchannel("A"), packed_atlas.getchannel("A")).getbbox()
    if alpha_diff is not None:
        raise SystemExit(f"packed roughness alpha changed after save: {alpha_diff}")
    print(f"built {atlas_size[0]}x{atlas_size[1]} atlas with {len(args.names)} regions; alpha exact")


if __name__ == "__main__":
    main()
