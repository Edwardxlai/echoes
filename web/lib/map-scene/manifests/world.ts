import type { WorldSceneManifest } from "../schema";

const RUNTIME = "/map-runtime/world";

export const WORLD_MANIFEST: WorldSceneManifest = {
  id: "world",
  version: 1,
  aspectRatio: 1586 / 992,
  worldSize: [100, (100 * 992) / 1586],
  // The ocean is deliberately much larger than the camera's travel area so
  // even the 60% mobile view can never reveal the edge of the rendered plane.
  environmentSize: [560, 560],
  cameraBounds: [42, 26],
  home: { target: [0, 7.5], zoomRatio: 0.93 },
  fitPadding: { desktop: 0.9, mobile: 0.84 },
  zoomRange: [0.6, 2.2],
  assets: {
    preview: `${RUNTIME}/preview/world_layered_preview_lod1_v01.webp`,
    environment: `${RUNTIME}/environment/world_atmosphere_overlay_lod1_v02.webp`,
    terrain: `${RUNTIME}/terrain/world_terrain_default_lod1_v01.webp`,
    contactShadow: `${RUNTIME}/terrain/world_terrain_contact_shadow_lod1_v02.webp`,
    height: `${RUNTIME}/terrain/world_terrain_height_lod1_v01.webp`,
    water: {
      baseColor: `${RUNTIME}/water/world_water_basecolor_tile_lod1_v01.webp`,
      normal: `${RUNTIME}/water/world_water_normal_tile_lod1_v01.webp`,
      roughness: `${RUNTIME}/water/world_water_roughness_tile_lod1_v01.webp`,
      flow: `${RUNTIME}/water/world_water_flow_tile_lod1_v01.webp`,
      ripples: [
        `${RUNTIME}/water/ripples/world_water_ring-open_lod1_v01.webp`,
        `${RUNTIME}/water/ripples/world_water_ring-double_lod1_v01.webp`,
        `${RUNTIME}/water/ripples/world_water_arc-wide_lod1_v01.webp`,
        `${RUNTIME}/water/ripples/world_water_arc-low_lod1_v01.webp`,
        `${RUNTIME}/water/ripples/world_water_wake_lod1_v01.webp`,
        `${RUNTIME}/water/ripples/world_water_foam-patch_lod1_v01.webp`,
      ],
    },
    coast: {
      shallow: `${RUNTIME}/coast/world_coast_shallow-water_lod1_v03.webp`,
      wetContact: `${RUNTIME}/coast/world_coast_wet-contact_lod1_v03.webp`,
      foam: `${RUNTIME}/coast/world_coast_foam_lod1_v03.webp`,
    },
    clouds: {
      far: [
        `${RUNTIME}/clouds/p0/world_cloud_far_01_lod1_v01.webp`,
        `${RUNTIME}/clouds/p0/world_cloud_far_02_lod1_v01.webp`,
        `${RUNTIME}/clouds/p0/world_cloud_far_03_lod1_v01.webp`,
        `${RUNTIME}/clouds/p0/world_cloud_far_04_lod1_v01.webp`,
      ],
      mid: [
        `${RUNTIME}/clouds/p0/world_cloud_mid_01_lod1_v01.webp`,
        `${RUNTIME}/clouds/p0/world_cloud_mid_02_lod1_v01.webp`,
        `${RUNTIME}/clouds/p0/world_cloud_mid_03_lod1_v01.webp`,
        `${RUNTIME}/clouds/p0/world_cloud_mid_04_lod1_v01.webp`,
      ],
      front: [
        `${RUNTIME}/clouds/p0/world_cloud_front_01_lod1_v01.webp`,
        `${RUNTIME}/clouds/p0/world_cloud_front_02_lod1_v01.webp`,
        `${RUNTIME}/clouds/p0/world_cloud_front_03_lod1_v01.webp`,
        `${RUNTIME}/clouds/p0/world_cloud_front_04_lod1_v01.webp`,
      ],
    },
  },
  regions: [
    {
      id: "region-eco",
      entityId: "eco",
      anchor: [-20, 4.4, 3.4],
      hitSize: [34, 22],
      rippleAnchor: [-39, -4],
      focus: { target: [-22.6, 7.7], zoomRatio: 1.34 },
      mask: `${RUNTIME}/regions/world_region_economy_mask_lod1_v02.webp`,
      landmark: `${RUNTIME}/landmarks/world_landmark_economy_lod1_v01.webp`,
      tint: "#d8bd68",
    },
    {
      id: "region-tech",
      entityId: "tech",
      anchor: [19, 9.4, 3.5],
      hitSize: [34, 21],
      rippleAnchor: [40, -2],
      focus: { target: [23.1, 8.3], zoomRatio: 1.34 },
      mask: `${RUNTIME}/regions/world_region_technology_mask_lod1_v02.webp`,
      landmark: `${RUNTIME}/landmarks/world_landmark_technology_lod1_v01.webp`,
      tint: "#9cb8db",
    },
    {
      id: "region-his",
      entityId: "his",
      anchor: [4, -8.8, 3.6],
      hitSize: [54, 30],
      rippleAnchor: [3, -28],
      focus: { target: [2.2, -3.5], zoomRatio: 1.18 },
      mask: `${RUNTIME}/regions/world_region_history_mask_lod1_v02.webp`,
      landmark: `${RUNTIME}/landmarks/world_landmark_history_lod1_v01.webp`,
      tint: "#d2aeb2",
    },
  ],
};
