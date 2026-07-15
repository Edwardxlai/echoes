/* ================================================================
   回响 · 地图策展配置（PRD V1.2 §8.1）

   这里仅保存「如何呈现」：固定位置、镜头、资源、命中区和路由。
   名称、观看状态、最近新增、内容丰富度与回响等业务真值在 data.ts；
   渲染层按 entityType/entityId 关联两者。x/y 是当前 2D 舞台的便利
   坐标，position 由同一份输入生成，供后续 2.5D/3D 渲染直接使用。
   ================================================================ */

import { VIDEOS } from "./data";

export type MapSceneType = "world" | "region" | "archipelago";
export type MapEntityType = "category" | "collection" | "video";
export type Vector3 = [number, number, number];

export interface CameraConfig {
  position: Vector3;
  target: Vector3;
  zoom?: number;
  fov?: number;
}

export interface EnvironmentConfig {
  asset: string;
  effects?: ("water" | "clouds" | "mist" | "parallax")[];
}

/** Business state joined onto a configured item at render time, never stored in a scene. */
export interface MapItemState {
  viewed?: boolean;
  echoCount?: number;
  isNew?: boolean;
  locked?: boolean;
  contentRich?: boolean;
}

/** Runtime join shape when a renderer needs PRD `MapItem.state`. */
export type RenderedMapItem = MapItem & { state: MapItemState };

export interface MapItem {
  id: string;
  entityType: MapEntityType;
  entityId: string;

  position: Vector3;
  /** 2D percentage-coordinate conveniences derived from position. */
  x: number;
  y: number;
  rotation?: Vector3;
  scale?: number;

  labelAnchor: Vector3;
  cameraTarget: CameraConfig;
  asset: string;
  hitArea?: string;
  /** Optional normalized (0–100) outline for pointer interaction on large regions. */
  hitPath?: string;
  hitBox: {
    shape: "ellipse" | "rounded";
    width: number;
    height: number;
    mobileWidth: number;
    mobileHeight: number;
  };
  route: string;

  /**
   * @deprecated Compatibility projection for the current SVG terrain only.
   * It is populated from Video.viewed/isNew in ARCHIPELAGO_ITEMS and is never
   * present in the canonical scene configuration.
   */
  status?: "unviewed" | "new";
}

export interface MapScene {
  id: string;
  type: MapSceneType;
  camera: CameraConfig;
  environment: EnvironmentConfig;
  items: MapItem[];
}

export type ItemSeed = Pick<
  MapItem,
  "id" | "entityType" | "entityId" | "asset" | "route" | "hitPath"
> & {
  x: number;
  y: number;
  z?: number;
  rotation?: Vector3;
  scale?: number;
  labelOffset?: Vector3;
  cameraZoom?: number;
  hitArea?: string;
  hitBox?: Partial<MapItem["hitBox"]>;
};

const hitBoxByEntity: Record<MapEntityType, MapItem["hitBox"]> = {
  category: { shape: "ellipse", width: 220, height: 100, mobileWidth: 110, mobileHeight: 72 },
  collection: { shape: "rounded", width: 190, height: 108, mobileWidth: 150, mobileHeight: 72 },
  video: { shape: "ellipse", width: 180, height: 104, mobileWidth: 150, mobileHeight: 72 },
};

const labelOffsetByEntity: Record<MapEntityType, Vector3> = {
  category: [0, 5, 0],
  collection: [0, 7, 0],
  video: [0, 8, 0],
};

/** Create both the PRD position tuple and the legacy x/y view from one source. */
const item = ({
  x,
  y,
  z = 0,
  rotation = [0, 0, 0],
  scale = 1,
  labelOffset,
  cameraZoom = 1.35,
  hitArea,
  hitBox,
  ...seed
}: ItemSeed): MapItem => {
  const position: Vector3 = [x, y, z];
  const [labelX, labelY, labelZ] = labelOffset ?? labelOffsetByEntity[seed.entityType];

  return {
    ...seed,
    position,
    x: position[0],
    y: position[1],
    rotation,
    scale,
    labelAnchor: [x + labelX, y + labelY, z + labelZ],
    cameraTarget: {
      position: [x, y, 36],
      target: position,
      zoom: cameraZoom,
    },
    hitArea: hitArea ?? `hit-${seed.id}`,
    hitBox: { ...hitBoxByEntity[seed.entityType], ...hitBox },
  };
};

/** 供服务端 real-data 层为真实解析内容动态生成 MapItem（同一套坐标/命中区规则）。 */
export const createMapItem = item;

export const WORLD_SCENE: MapScene = {
  id: "world",
  type: "world",
  camera: { position: [50, 50, 100], target: [50, 50, 0], zoom: 1 },
  environment: {
    asset: "/map/world/world_master_visual_default_lod1_v01.webp",
    effects: ["water", "clouds", "parallax"],
  },
  items: [
    item({
      id: "region-eco",
      entityType: "category",
      entityId: "eco",
      x: 30,
      y: 43,
      asset: "/map/world/world_economy_visual_focus_lod1_v01.webp",
      route: "/category/eco",
      cameraZoom: 1.28,
      hitPath:
        "M5 33C8 23 18 18 28 18C34 12 43 15 47 22C51 29 48 36 43 41C40 46 39 53 36 58C33 65 28 69 21 69C13 69 7 62 5 54C1 48 1 40 5 33Z",
      hitBox: { width: 170, height: 86, mobileWidth: 104, mobileHeight: 68 },
    }),
    item({
      id: "region-tech",
      entityType: "category",
      entityId: "tech",
      x: 69,
      y: 35,
      asset: "/map/world/world_technology_visual_focus_lod1_v01.webp",
      route: "/category/tech",
      cameraZoom: 1.28,
      hitPath:
        "M50 18C56 11 64 10 70 12C77 7 87 9 91 16C95 22 92 29 88 34C94 39 93 48 88 53C82 57 75 54 69 57C62 54 57 52 53 49C50 46 49 42 50 37C46 33 46 24 50 18Z",
      hitBox: { width: 170, height: 86, mobileWidth: 104, mobileHeight: 68 },
    }),
    item({
      id: "region-his",
      entityType: "category",
      entityId: "his",
      x: 54,
      y: 64,
      asset: "/map/world/world_history_visual_focus_lod1_v01.webp",
      route: "/category/his",
      cameraZoom: 1.28,
      hitPath:
        "M34 57C39 52 47 53 53 55C59 51 68 52 72 57C79 54 87 58 87 64C91 68 88 74 84 77C86 82 80 86 73 86C67 90 59 88 54 85C47 89 39 85 37 79C31 77 29 69 32 64C29 61 31 58 34 57Z",
      hitBox: { width: 170, height: 86, mobileWidth: 104, mobileHeight: 68 },
    }),
  ],
};

export const REGION_SCENES: Record<string, MapScene> = {
  eco: {
    id: "region-eco",
    type: "region",
    camera: { position: [50, 50, 88], target: [50, 50, 0], zoom: 1 },
    environment: { asset: "environment/region-eco", effects: ["water", "clouds", "parallax"] },
    items: [
      item({
        id: "landmark-c1",
        entityType: "collection",
        entityId: "c1",
        x: 34,
        y: 48,
        asset: "landmark/city",
        route: "/collection/c1",
      }),
      item({
        id: "landmark-c2",
        entityType: "collection",
        entityId: "c2",
        x: 68,
        y: 58,
        asset: "landmark/tower",
        route: "/collection/c2",
      }),
    ],
  },
  his: {
    id: "region-his",
    type: "region",
    camera: { position: [50, 50, 88], target: [50, 50, 0], zoom: 1 },
    environment: { asset: "environment/region-history", effects: ["water", "mist", "parallax"] },
    items: [
      item({
        id: "landmark-c3",
        entityType: "collection",
        entityId: "c3",
        x: 34,
        y: 48,
        asset: "landmark/ruins",
        route: "/collection/c3",
      }),
    ],
  },
  tech: {
    id: "region-tech",
    type: "region",
    camera: { position: [50, 50, 88], target: [50, 50, 0], zoom: 1 },
    environment: { asset: "environment/region-tech", effects: ["water", "clouds", "parallax"] },
    items: [
      item({
        id: "landmark-c4",
        entityType: "collection",
        entityId: "c4",
        x: 50,
        y: 50,
        asset: "landmark/port",
        route: "/collection/c4",
      }),
    ],
  },
};

export const ARCHIPELAGO_SCENES: Record<string, MapScene> = {
  c1: {
    id: "archipelago-c1",
    type: "archipelago",
    camera: { position: [50, 50, 82], target: [50, 50, 0], zoom: 1 },
    environment: { asset: "environment/archipelago-eco", effects: ["water", "clouds", "mist"] },
    items: [
      item({ id: "island-v1", entityType: "video", entityId: "v1", x: 30, y: 44, asset: "island/atoll", route: "/video/v1", rotation: [0, 0, -0.04], hitBox: { mobileWidth: 116 } }),
      item({ id: "island-v2", entityType: "video", entityId: "v2", x: 60, y: 32, asset: "island/terrace", route: "/video/v2", rotation: [0, 0, 0.03], hitBox: { mobileWidth: 116 } }),
      item({ id: "island-v3", entityType: "video", entityId: "v3", x: 72, y: 62, asset: "island/rock", route: "/video/v3", rotation: [0, 0, -0.02] }),
    ],
  },
  c2: {
    id: "archipelago-c2",
    type: "archipelago",
    camera: { position: [50, 50, 82], target: [50, 50, 0], zoom: 1 },
    environment: { asset: "environment/archipelago-eco", effects: ["water", "clouds"] },
    items: [
      item({ id: "island-v6", entityType: "video", entityId: "v6", x: 38, y: 40, asset: "island/atoll", route: "/video/v6", rotation: [0, 0, 0.02] }),
      item({ id: "island-v7", entityType: "video", entityId: "v7", x: 64, y: 56, asset: "island/terrace", route: "/video/v7", rotation: [0, 0, -0.03] }),
    ],
  },
  c3: {
    id: "archipelago-c3",
    type: "archipelago",
    camera: { position: [50, 50, 82], target: [50, 50, 0], zoom: 1 },
    environment: { asset: "environment/archipelago-history", effects: ["water", "mist"] },
    items: [
      item({ id: "island-v4", entityType: "video", entityId: "v4", x: 36, y: 46, asset: "island/rock", route: "/video/v4", rotation: [0, 0, -0.02] }),
      item({ id: "island-v5", entityType: "video", entityId: "v5", x: 66, y: 52, asset: "island/terrace", route: "/video/v5", rotation: [0, 0, 0.04] }),
    ],
  },
  c4: {
    id: "archipelago-c4",
    type: "archipelago",
    camera: { position: [50, 50, 82], target: [50, 50, 0], zoom: 1 },
    environment: { asset: "environment/archipelago-tech", effects: ["water", "clouds", "parallax"] },
    items: [
      item({ id: "island-v8", entityType: "video", entityId: "v8", x: 40, y: 42, asset: "island/atoll", route: "/video/v8", rotation: [0, 0, 0.03] }),
      item({ id: "island-v9", entityType: "video", entityId: "v9", x: 66, y: 60, asset: "island/rock", route: "/video/v9", rotation: [0, 0, -0.04] }),
    ],
  },
};

const itemsOf = (scenes: Record<string, MapScene>): Record<string, MapItem[]> =>
  Object.fromEntries(Object.entries(scenes).map(([id, scene]) => [id, scene.items]));

/** Compatibility exports for the current 2D page consumers. Prefer the scene exports in new code. */
export const WORLD_ITEMS = WORLD_SCENE.items;
export const REGION_ITEMS = itemsOf(REGION_SCENES);
export const ARCHIPELAGO_ITEMS: Record<string, MapItem[]> = Object.fromEntries(
  Object.entries(ARCHIPELAGO_SCENES).map(([collectionId, scene]) => [
    collectionId,
    scene.items.map((mapItem) => {
      const video = VIDEOS[mapItem.entityId];
      const status = !video?.viewed ? "unviewed" : video.isNew ? "new" : undefined;
      return status ? { ...mapItem, status } : mapItem;
    }),
  ]),
);
