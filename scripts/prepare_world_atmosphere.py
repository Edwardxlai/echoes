"""Prepare the T00 atmosphere tests as versioned source assets.

The T00 cloud exports were flattened over a checkerboard. This script estimates
the checker carrier, reconstructs a soft alpha channel, crops the transparent
margin, and writes archival variants. Pass --public only when the frontend has
an explicit consumer. The water detail is resized separately because it is used
as a low-opacity masked texture.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


CLOUDS = (
    ("T00-04_cloud_far_01_v01.png", "world_cloud_far_01_default_lod1_v01", 820, 0.16),
    ("T00-04_cloud_mid_01_v01.png", "world_cloud_mid_01_default_lod1_v01", 1180, 0.14),
    ("T00-04_cloud_front_01_v01.png", "world_cloud_front_01_default_lod1_v01", 1380, 0.14),
)


def box_mean(values: np.ndarray, radius: int) -> np.ndarray:
    padded = np.pad(values, ((radius, radius), (radius, radius)), mode="reflect")
    integral = np.pad(padded, ((1, 0), (1, 0)), mode="constant").cumsum(0).cumsum(1)
    size = radius * 2 + 1
    return (
        integral[size:, size:]
        - integral[:-size, size:]
        - integral[size:, :-size]
        + integral[:-size, :-size]
    ) / (size * size)


def checker_sign(luminance: np.ndarray) -> tuple[np.ndarray, int]:
    top = np.median(luminance[4:7, :], axis=0)
    left = np.median(luminance[:, 4:7], axis=1)
    samples = np.concatenate((top, left))
    split = (np.percentile(samples, 15) + np.percentile(samples, 85)) / 2
    sign_x = np.where(top > split, 1.0, -1.0)
    sign_y = np.where(left > split, 1.0, -1.0)
    sign = sign_y[:, None] * sign_x[None, :]

    if np.median(luminance[:20, :][sign[:20, :] > 0]) < np.median(
        luminance[:20, :][sign[:20, :] < 0]
    ):
        sign = -sign

    edges = np.flatnonzero(sign_x[1:] != sign_x[:-1]) + 1
    cell = int(round(float(np.median(np.diff(edges)))))
    return sign, cell


def extract_cloud(source: Path, cutoff: float) -> Image.Image:
    rgb = np.asarray(Image.open(source).convert("RGB"), dtype=np.float32)
    height, width, _ = rgb.shape
    luminance = rgb.mean(2)
    sign, cell = checker_sign(luminance)

    border = np.zeros((height, width), dtype=bool)
    margin = max(8, min(height, width) // 10)
    border[:margin] = True
    border[-margin:] = True
    border[:, :margin] = True
    border[:, -margin:] = True

    bright = np.median(rgb[border & (sign > 0)], axis=0)
    dark = np.median(rgb[border & (sign < 0)], axis=0)
    checker_amplitude = max(1.0, float(((bright - dark) / 2).mean()))

    local_tone = box_mean(luminance, cell * 2)
    carrier = box_mean((luminance - local_tone) * sign, cell)
    alpha = np.clip(1 - carrier / checker_amplitude, 0, 1)
    alpha_image = Image.fromarray(np.uint8(alpha * 255), "L").filter(
        ImageFilter.GaussianBlur(max(1, cell / 20))
    )
    alpha = np.asarray(alpha_image, dtype=np.float32) / 255
    alpha = np.clip((alpha - cutoff) / (1 - cutoff), 0, 1)

    background = np.where(sign[..., None] > 0, bright, dark)
    safe_alpha = np.maximum(alpha[..., None], 0.08)
    foreground = np.clip((rgb - (1 - alpha[..., None]) * background) / safe_alpha, 0, 255)
    foreground_image = Image.fromarray(np.uint8(foreground), "RGB").filter(
        ImageFilter.GaussianBlur(max(0.8, cell / 18))
    )
    foreground_smooth = np.asarray(foreground_image, dtype=np.float32)
    foreground = foreground * 0.65 + foreground_smooth * 0.35
    edge_white = np.array([246, 250, 252], dtype=np.float32)
    foreground = foreground * alpha[..., None] + edge_white * (1 - alpha[..., None])

    output = Image.fromarray(
        np.dstack((np.uint8(foreground), np.uint8(alpha * 255))), "RGBA"
    )
    bounds = output.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError(f"No foreground recovered from {source}")

    padding = max(16, cell)
    left, top, right, bottom = bounds
    return output.crop(
        (
            max(0, left - padding),
            max(0, top - padding),
            min(width, right + padding),
            min(height, bottom + padding),
        )
    )


def fit_width(image: Image.Image, width: int) -> Image.Image:
    if image.width <= width:
        return image
    height = round(image.height * width / image.width)
    return image.resize((width, height), Image.Resampling.LANCZOS)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source", type=Path, default=Path("map-art/00_style/reference-t00/source")
    )
    parser.add_argument(
        "--cloud-archive", type=Path, default=Path("map-art/60_common/clouds")
    )
    parser.add_argument(
        "--water-archive", type=Path, default=Path("map-art/60_common/water")
    )
    parser.add_argument(
        "--public",
        type=Path,
        help="Optional runtime output directory. Omit until the frontend consumes these assets.",
    )
    args = parser.parse_args()
    args.cloud_archive.mkdir(parents=True, exist_ok=True)
    args.water_archive.mkdir(parents=True, exist_ok=True)
    if args.public:
        args.public.mkdir(parents=True, exist_ok=True)

    for source_name, output_name, max_width, cutoff in CLOUDS:
        cloud = fit_width(extract_cloud(args.source / source_name, cutoff), max_width)
        cloud.save(args.cloud_archive / f"{output_name}.png", optimize=True)
        if args.public:
            cloud.save(args.public / f"{output_name}.webp", "WEBP", quality=84, method=6)

    water = Image.open(args.source / "T00-05_water_detail_source_v01.png").convert("RGB")
    water = water.resize((768, 768), Image.Resampling.LANCZOS)
    water_name = "world_water_detail_default_lod1_v01"
    water.save(args.water_archive / f"{water_name}.webp", "WEBP", quality=78, method=6)
    if args.public:
        water.save(args.public / f"{water_name}.webp", "WEBP", quality=78, method=6)


if __name__ == "__main__":
    main()
