"""Build the browser-ready W06-W11 world-map texture package.

The source PNGs stay untouched in map-art. Runtime WebP files are versioned,
alpha-safe, and kept as independent layers so the map never falls back to a
single baked image.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "web/public/map-runtime/world"
CLOUD_SOURCE = ROOT / "map-art/60_common/clouds"
WATER_SOURCE = ROOT / "map-art/60_common/water"
COAST_SOURCE = ROOT / "map-art/20_world/technical"


def save_webp(source: Path, target: Path, *, quality: int = 86, lossless: bool = False) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    image = Image.open(source)
    image.save(target, "WEBP", quality=quality, method=6, lossless=lossless)


def build_clouds() -> None:
    target = PUBLIC / "clouds/p0"
    for group, source_prefix in (("far", "W06"), ("mid", "W07"), ("front", "W08")):
        for index in range(1, 5):
            source = CLOUD_SOURCE / f"{source_prefix}_world_cloud_{group}_{index:02d}_alpha_v01.png"
            output = target / f"world_cloud_{group}_{index:02d}_lod1_v01.webp"
            save_webp(source, output, quality=88)


def build_water() -> None:
    target = PUBLIC / "water"
    save_webp(
        WATER_SOURCE / "W09_water_basecolor_tile_v01.png",
        target / "world_water_basecolor_tile_lod1_v01.webp",
        quality=84,
    )
    save_webp(
        WATER_SOURCE / "technical/W09_water_normal-reference_tile_v01.png",
        target / "world_water_normal_tile_lod1_v01.webp",
        quality=88,
    )
    save_webp(
        WATER_SOURCE / "technical/W09_water_roughness-reference_tile_v01.png",
        target / "world_water_roughness_tile_lod1_v01.webp",
        quality=84,
    )
    save_webp(
        WATER_SOURCE / "technical/W09_water_flow-mask_tile_v01.png",
        target / "world_water_flow_tile_lod1_v01.webp",
        quality=88,
    )

    atlas = Image.open(WATER_SOURCE / "atlas/W10_water-ripples_atlas_alpha_v01.png").convert("RGBA")
    names = ("ring-open", "ring-double", "arc-wide", "arc-low", "wake", "foam-patch")
    cell_width = atlas.width // 3
    cell_height = atlas.height // 2
    for index, name in enumerate(names):
        row, column = divmod(index, 3)
        left = column * cell_width
        top = row * cell_height
        right = atlas.width if column == 2 else (column + 1) * cell_width
        bottom = atlas.height if row == 1 else (row + 1) * cell_height
        cell = atlas.crop((left, top, right, bottom))
        bounds = cell.getchannel("A").getbbox()
        if not bounds:
            raise RuntimeError(f"W10 cell {name} has no visible pixels")
        crop = cell.crop(bounds)
        padding = 12
        padded = Image.new("RGBA", (crop.width + padding * 2, crop.height + padding * 2))
        padded.alpha_composite(crop, (padding, padding))
        output = target / "ripples" / f"world_water_{name}_lod1_v01.webp"
        output.parent.mkdir(parents=True, exist_ok=True)
        padded.save(output, "WEBP", quality=90, method=6)


def build_coast() -> None:
    target = PUBLIC / "coast"
    files = {
        "W11_world_coast_shallow-water_alpha_v03.png": "world_coast_shallow-water_lod1_v03.webp",
        "W11_world_coast_wet-contact_alpha_v03.png": "world_coast_wet-contact_lod1_v03.webp",
        "W11_world_coast_foam-alpha_v03.png": "world_coast_foam_lod1_v03.webp",
    }
    for source_name, output_name in files.items():
        save_webp(COAST_SOURCE / source_name, target / output_name, quality=92, lossless=True)


if __name__ == "__main__":
    build_clouds()
    build_water()
    build_coast()
    print(f"World P0 runtime package written to {PUBLIC}")
