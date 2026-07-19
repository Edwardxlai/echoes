"""Derive the history-region coast package from the terrain alpha.

Mirrors the world W11 layer recipe (shallow halo / wet contact line / foam /
contact shadow) so the region map reads as one painting instead of a terrain
cutout floating on the water tile. Colors and alpha ceilings are sampled from
the world W11/W03 assets to keep both maps in the same visual language.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
REGION = ROOT / "web/public/map-runtime/regions/history"
TERRAIN = REGION / "terrain/region_history_terrain_default_lod1_v05.webp"

SHALLOW_RGB = (154, 220, 224)
SHALLOW_ALPHA = 70 / 255
WET_RGB = (43, 105, 112)
WET_ALPHA = 56 / 255
FOAM_RGB = (248, 253, 250)
FOAM_ALPHA = 73 / 255
SHADOW_RGB = (29, 48, 48)
SHADOW_ALPHA = 76 / 255


def blur(mask: np.ndarray, radius: float) -> np.ndarray:
    image = Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8))
    return np.asarray(image.filter(ImageFilter.GaussianBlur(radius))).astype(np.float32) / 255


def shift_down(mask: np.ndarray, rows: int) -> np.ndarray:
    shifted = np.zeros_like(mask)
    shifted[rows:] = mask[:-rows]
    return shifted


def save_layer(alpha: np.ndarray, rgb: tuple[int, int, int], target: Path) -> None:
    height, width = alpha.shape
    layer = np.zeros((height, width, 4), dtype=np.uint8)
    layer[..., 0], layer[..., 1], layer[..., 2] = rgb
    layer[..., 3] = (np.clip(alpha, 0, 1) * 255).astype(np.uint8)
    target.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(layer).save(target, "WEBP", quality=92, method=6, lossless=True)
    print(f"wrote {target.relative_to(ROOT)}")


def main() -> None:
    terrain = Image.open(TERRAIN).convert("RGBA")
    mask = (np.asarray(terrain).astype(np.float32)[..., 3] / 255 > 0.06).astype(np.float32)

    # Shallow water: a wide soft halo hugging the coast, brighter close in.
    halo = np.clip(blur(mask, 9) * 0.62 + blur(mask, 26) * 0.55, 0, 1)
    save_layer(halo * SHALLOW_ALPHA, SHALLOW_RGB, REGION / "coast/region_history_coast-shallow_default_lod1_v01.webp")

    # Wet contact: a thin darker line right at the waterline.
    edge = blur(mask, 2.4)
    ring = np.clip(1 - np.abs(edge * 2 - 1), 0, 1) ** 1.6
    save_layer(ring * WET_ALPHA, WET_RGB, REGION / "coast/region_history_coast-wet_default_lod1_v01.webp")

    # Foam: an even tighter bright line, broken up so it reads hand-painted.
    tight = blur(mask, 1.1)
    foam_ring = np.clip(1 - np.abs(tight * 2 - 1), 0, 1) ** 2.2
    rng = np.random.default_rng(11)
    noise = blur(rng.random(mask.shape).astype(np.float32), 2.6)
    breakup = np.clip((noise - 0.42) * 3.2, 0, 1)
    save_layer(foam_ring * breakup * FOAM_ALPHA, FOAM_RGB, REGION / "coast/region_history_coast-foam_default_lod1_v01.webp")

    # Contact shadow: blurred silhouette pushed slightly down, as in W03.
    shadow = blur(shift_down(mask, 9), 14)
    save_layer(shadow * SHADOW_ALPHA, SHADOW_RGB, REGION / "terrain/region_history_contact-shadow_default_lod1_v01.webp")


if __name__ == "__main__":
    main()
