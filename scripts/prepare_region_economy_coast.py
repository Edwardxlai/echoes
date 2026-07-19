"""Build the economy-region runtime terrain and shared-water coast layers."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (
    ROOT
    / "map-art/30_regions/economy/terrain"
    / "R01_economy_region_terrain_six-slot_alpha_v03.png"
)
REGION = ROOT / "web/public/map-runtime/regions/economy"
TERRAIN = REGION / "terrain/region_economy_terrain_default_lod1_v03.webp"

LANDMARKS = (
    (
        "R02_economy_landmark_misc-eco_alpha_v03.png",
        "region_economy_landmark_misc-eco_lod1_v03.webp",
    ),
    (
        "R03_economy_landmark_financial-titans_alpha_v03.png",
        "region_economy_landmark_da2e1ad3_lod1_v03.webp",
    ),
    (
        "R04_economy_landmark_internet-epic_alpha_v03.png",
        "region_economy_landmark_b9702449_lod1_v03.webp",
    ),
    (
        "R05_economy_landmark_future-industrial-guild_alpha_v01.png",
        "region_economy_landmark_future-industrial-guild_lod1_v01.webp",
    ),
    (
        "R06_economy_landmark_future-logistics-customs_alpha_v01.png",
        "region_economy_landmark_future-logistics-customs_lod1_v01.webp",
    ),
    (
        "R07_economy_landmark_future-enterprise-forum_alpha_v01.png",
        "region_economy_landmark_future-enterprise-forum_lod1_v01.webp",
    ),
)

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


def save_landmarks() -> None:
    source_dir = ROOT / "map-art/30_regions/economy/landmarks"
    target_dir = REGION / "landmarks"
    target_dir.mkdir(parents=True, exist_ok=True)

    for source_name, target_name in LANDMARKS:
        landmark = Image.open(source_dir / source_name).convert("RGBA")
        pixels = np.asarray(landmark).copy()
        alpha = pixels[..., 3]

        # Earlier economy keys left the whole building semi-transparent. Keep
        # only a soft one-pixel contour and restore the authored interior.
        silhouette = Image.fromarray(np.where(alpha > 12, 255, 0).astype(np.uint8))
        softened = np.asarray(silhouette.filter(ImageFilter.GaussianBlur(0.65))).copy()
        interior = np.asarray(silhouette.filter(ImageFilter.MinFilter(3))) == 255
        softened[interior] = 255
        pixels[..., 3] = softened
        landmark = Image.fromarray(pixels)
        alpha = pixels[..., 3]
        ys, xs = np.where(alpha > 12)
        padding = 16
        crop = (
            max(0, int(xs.min()) - padding),
            max(0, int(ys.min()) - padding),
            min(landmark.width, int(xs.max()) + padding + 1),
            min(landmark.height, int(ys.max()) + padding + 1),
        )
        landmark = landmark.crop(crop)
        target = target_dir / target_name
        landmark.save(target, "WEBP", quality=100, method=4, lossless=True)
        print(f"wrote {target.relative_to(ROOT)} ({landmark.width}x{landmark.height})")


def main() -> None:
    terrain = Image.open(SOURCE).convert("RGBA")
    TERRAIN.parent.mkdir(parents=True, exist_ok=True)
    terrain.save(TERRAIN, "WEBP", quality=100, method=6, lossless=True)
    print(f"wrote {TERRAIN.relative_to(ROOT)}")
    save_landmarks()

    mask = (np.asarray(terrain).astype(np.float32)[..., 3] / 255 > 0.06).astype(np.float32)

    halo = np.clip(blur(mask, 9) * 0.62 + blur(mask, 26) * 0.55, 0, 1)
    save_layer(
        halo * SHALLOW_ALPHA,
        SHALLOW_RGB,
        REGION / "coast/region_economy_coast-shallow_default_lod1_v01.webp",
    )

    edge = blur(mask, 2.4)
    ring = np.clip(1 - np.abs(edge * 2 - 1), 0, 1) ** 1.6
    save_layer(
        ring * WET_ALPHA,
        WET_RGB,
        REGION / "coast/region_economy_coast-wet_default_lod1_v01.webp",
    )

    tight = blur(mask, 1.1)
    foam_ring = np.clip(1 - np.abs(tight * 2 - 1), 0, 1) ** 2.2
    rng = np.random.default_rng(11)
    noise = blur(rng.random(mask.shape).astype(np.float32), 2.6)
    breakup = np.clip((noise - 0.42) * 3.2, 0, 1)
    save_layer(
        foam_ring * breakup * FOAM_ALPHA,
        FOAM_RGB,
        REGION / "coast/region_economy_coast-foam_default_lod1_v01.webp",
    )

    shadow = blur(shift_down(mask, 9), 14)
    save_layer(
        shadow * SHADOW_ALPHA,
        SHADOW_RGB,
        REGION / "terrain/region_economy_contact-shadow_default_lod1_v01.webp",
    )


if __name__ == "__main__":
    main()
