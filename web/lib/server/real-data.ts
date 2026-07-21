/* ================================================================
   回响 · 真实解析数据 → 地图三层可渲染形状（服务端专用）
   坐标规则：槽位表按 createdAt 顺序分配——数据不删不改就永远落同一格，
   守住"多次进入位置一致"的固定策展红线（PRD §5.2.2）。
   种子数据（lib/data.ts）在地图上让位给真实数据，详情页仍可直链访问。
   ================================================================ */
import { createMapItem, type MapItem } from "@/lib/map-config";
import {
  listCollections, listAssetsByCollection, getCollectionRow, getAnalysis, getSynthesis,
  getCollectionGapFill,
  getCollectionExtend,
  listUnknownSeaAssets,
  type CollectionRow, type SourceAsset,
} from "./store";
import type { Synthesis, CognitiveExpansion } from "@/lib/data";

export { hasRealMapContent } from "./store";

/* ---------- 槽位表（舞台 0~100 百分比坐标，避开边缘与信息面板） ---------- */
const REGION_SLOTS = [
  { x: 34, y: 48 }, { x: 66, y: 56 }, { x: 50, y: 30 }, { x: 28, y: 68 },
  { x: 72, y: 34 }, { x: 46, y: 72 }, { x: 60, y: 44 }, { x: 38, y: 26 },
];
/* eco 槽位带手调卡片偏移（labelOffset，相对建筑脚底）：卡片落各自建筑正下方空地，
   不压建筑本体、不与邻卡挤靠；镜头聚焦仍对准建筑坐标。 */
interface EcoSlot { x: number; y: number; labelOffset: [number, number, number] }
interface IslandSlot { x: number; y: number; labelOffset?: [number, number, number] }
const ECONOMY_REGION_SLOT_BY_ID: Record<string, EcoSlot> = {
  "misc-eco": { x: 31.7, y: 62.5, labelOffset: [-2, 3, 0] },
  da2e1ad3: { x: 48.2, y: 38.2, labelOffset: [0, 2.6, 0] },
  b9702449: { x: 70.5, y: 35.8, labelOffset: [2, 2.2, 0] },
};
/** 表外的新合集（自动聚类等）顶上"未来建筑"的位置——
    与 RegionTerrain 的 ECONOMY_FUTURE_SLOTS 同坐标同序，美术侧按同序换成对应建筑。 */
const ECONOMY_REGION_OVERFLOW_SLOTS: EcoSlot[] = [
  { x: 43, y: 69, labelOffset: [2, 2.6, 0] },
  { x: 37.4, y: 79, labelOffset: [0, 2.6, 0] },
  { x: 72.2, y: 52.8, labelOffset: [0, 2.6, 0] },
];
const TECHNOLOGY_REGION_SLOTS = [
  { x: 34.2, y: 56.2 }, { x: 59.3, y: 70.7 }, { x: 41.1, y: 20.6 },
  { x: 23.4, y: 38.6 }, { x: 85.6, y: 38.9 }, { x: 84.3, y: 68.9 },
];
const ISLAND_SLOTS = [
  { x: 30, y: 44 }, { x: 60, y: 32 }, { x: 72, y: 62 }, { x: 44, y: 60 },
  { x: 54, y: 42 }, { x: 26, y: 28 }, { x: 78, y: 38 }, { x: 38, y: 76 },
  { x: 64, y: 74 }, { x: 20, y: 58 }, { x: 50, y: 22 }, { x: 80, y: 52 },
];
const NEW_CHINA_COLLECTION_ID = "07ae1f5b";
const TWO_JIN_COLLECTION_ID = "832cf0f1";
const MISC_TECH_COLLECTION_ID = "misc-tech";
const MISC_ECO_COLLECTION_ID = "misc-eco";
const ECONOMY_SERIES_COLLECTION_ID = "da2e1ad3";
const FINANCIAL_BUBBLES_COLLECTION_ID = "tc-25dff437";
const INTERNET_EPIC_COLLECTION_ID = "b9702449";
export const UNKNOWN_SEA_COLLECTION_ID = "unknown-sea";
const NEW_CHINA_ISLAND_SLOTS = [
  { x: 20, y: 32 }, { x: 47, y: 24 }, { x: 76, y: 35 },
  { x: 79, y: 68 }, { x: 51, y: 73 }, { x: 22, y: 64 },
];
const TWO_JIN_ISLAND_SLOTS = [
  { x: 20, y: 34 }, { x: 48, y: 25 }, { x: 77, y: 35 },
  { x: 78, y: 67 }, { x: 50, y: 74 }, { x: 21, y: 65 },
];
// 科技散篇集固定为一圈有呼吸感的六岛构图。阅读顺序从左上开始顺时针，
// 岛体和标签各占独立纵向空间，避免通用槽位造成的中心堆叠与交叉压盖。
const MISC_TECH_ISLAND_SLOTS = [
  { x: 22, y: 35 }, { x: 50, y: 25 }, { x: 78, y: 35 },
  { x: 78, y: 68 }, { x: 50, y: 76 }, { x: 22, y: 68 },
];
// 经济群岛采用“主岛 + 两翼 + 前景岛链”的稳定构图，避免通用槽位产生无方向的散点。
// 第 8 座（前景岛链收尾）落在底部正中，与两侧前景岛拉开距离，不再挤进兜底公式。
const MISC_ECO_ISLAND_SLOTS = [
  { x: 50, y: 27 }, { x: 25, y: 39 }, { x: 75, y: 40 },
  { x: 37, y: 61 }, { x: 63, y: 61 }, { x: 18, y: 72 }, { x: 82, y: 72 },
  { x: 50, y: 82 },
];
const ECONOMY_SERIES_ISLAND_SLOTS = [
  { x: 50, y: 22 }, { x: 18, y: 39 }, { x: 82, y: 39 },
  { x: 29, y: 70 }, { x: 71, y: 70 }, { x: 50, y: 82 },
];
// “金融泡沫与崩盘”使用疏朗的四角构图，避免较大的经济岛体在中央互相压叠。
const FINANCIAL_BUBBLES_ISLAND_SLOTS = [
  { x: 23, y: 27 }, { x: 77, y: 29 },
  { x: 76, y: 70 }, { x: 24, y: 72 },
];
// “互联网史诗”包含两套不同的岛屿美术。左侧双岛作为明亮产业组，
// 右侧四岛作为深色公司史组，避免通用槽位把上下两座岛叠成一座。
const INTERNET_EPIC_ISLAND_SLOTS: IslandSlot[] = [
  { x: 25, y: 64, labelOffset: [-2, 10, 0] },
  { x: 56, y: 30, labelOffset: [0, 10, 0] },
  { x: 84, y: 69, labelOffset: [0, 10, 0] },
  { x: 54, y: 70, labelOffset: [0, 10, 0] },
  { x: 84, y: 31, labelOffset: [0, 10, 0] },
  { x: 22, y: 30, labelOffset: [0, 10, 0] },
];
const UNKNOWN_SEA_ISLAND_SLOTS = [
  { x: 20, y: 34 }, { x: 50, y: 24 }, { x: 80, y: 35 },
  { x: 78, y: 68 }, { x: 50, y: 76 }, { x: 22, y: 68 },
];
/** 黄金角螺旋：下标越大半径越向外扩、角度按黄金角错开，
    保证相邻下标不会径向对齐、扎堆在海域同一角落——比取模公式更均匀。 */
const GOLDEN_ANGLE_DEG = 137.50776405003785;
const overflowSlot = (k: number) => {
  const theta = ((k * GOLDEN_ANGLE_DEG) % 360) * (Math.PI / 180);
  const r = Math.min(1, Math.sqrt((k + 1) / 8));
  return { x: 50 + r * 34 * Math.cos(theta), y: 50 + r * 32 * Math.sin(theta) };
};
/** 槽位用尽后的确定性兜底：由下标推位置，仍然稳定。 */
const slotAt = (slots: { x: number; y: number }[], i: number) =>
  slots[i] ?? overflowSlot(i - slots.length);

const GLYPHS = ["city", "tower", "ruins", "port"] as const;
const TERRAIN_BY_GLYPH: Record<(typeof GLYPHS)[number], string> = {
  city: "一座新落成的城市地标",
  tower: "一座刚点亮的瞭望塔",
  ruins: "一片正在整理的遗迹",
  port: "一座迎来新船的港口",
};
const ISLAND_ASSETS = ["island/atoll", "island/terrace", "island/rock"];
const ISLAND_ROTATIONS: [number, number, number][] = [
  [0, 0, -0.04], [0, 0, 0.03], [0, 0, -0.02], [0, 0, 0.04],
];

const NEW_WINDOW_MS = 7 * 24 * 3600 * 1000;
const isNewAsset = (a: SourceAsset) => Date.now() - Date.parse(a.createdAt) < NEW_WINDOW_MS;

const echoCountOf = (assetId: string) => getAnalysis(assetId)?.echoes?.length ?? 0;

/* ---------- 大陆层：真实合集地标 ---------- */
export interface RealLandmark {
  id: string;
  name: string;
  categoryId: string;
  videoCount: number;
  echoCount: number;
  terrain: string;
  glyphKind: (typeof GLYPHS)[number];
  mapItem: MapItem;
  /** 合集级跨视频合成是否已生成——决定区域地图信息面板是否出"合集解析"入口。 */
  hasSynthesis: boolean;
  /** 原合集链接（仅 mix 合集有；自动聚类合集为空串）。 */
  sourceUrl: string;
}

function toLandmark(row: CollectionRow, index: number, overflowIndex: number): RealLandmark {
  const assets = listAssetsByCollection(row.id);
  const regionSlots = row.categoryId === "tech" ? TECHNOLOGY_REGION_SLOTS : REGION_SLOTS;
  const slot =
    row.categoryId === "eco"
      ? (ECONOMY_REGION_SLOT_BY_ID[row.id] ??
        ECONOMY_REGION_OVERFLOW_SLOTS[overflowIndex] ??
        slotAt(regionSlots, index))
      : slotAt(regionSlots, index);
  const { x, y } = slot;
  const labelOffset = (slot as Partial<EcoSlot>).labelOffset;
  const glyphKind = GLYPHS[index % GLYPHS.length];
  return {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    videoCount: assets.length,
    echoCount: assets.reduce((sum, a) => sum + echoCountOf(a.id), 0),
    terrain: TERRAIN_BY_GLYPH[glyphKind],
    glyphKind,
    hasSynthesis: getSynthesis(row.id) !== null,
    sourceUrl: row.sourceUrl ?? "",
    mapItem: createMapItem({
      id: `landmark-${row.id}`,
      entityType: "collection",
      entityId: row.id,
      x,
      y,
      ...(labelOffset ? { labelOffset } : {}),
      asset: `landmark/${glyphKind}`,
      route: `/collection/${row.id}`,
    }),
  };
}

export function realCollectionsOf(categoryId: string): RealLandmark[] {
  let overflow = 0;
  return listCollections(categoryId).map((row, i) =>
    toLandmark(row, i, ECONOMY_REGION_SLOT_BY_ID[row.id] ? -1 : overflow++)
  );
}

/* ---------- 世界层：每个大类的真实计数 ---------- */
export interface RealCategorySummary {
  collectionCount: number;
  videoCount: number;
  echoCount: number;
}

export function realWorldSummary(): Record<string, RealCategorySummary> {
  const summary: Record<string, RealCategorySummary> = {};
  for (const row of listCollections()) {
    const assets = listAssetsByCollection(row.id);
    const s = (summary[row.categoryId] ??= { collectionCount: 0, videoCount: 0, echoCount: 0 });
    s.collectionCount += 1;
    s.videoCount += assets.length;
    s.echoCount += assets.reduce((sum, a) => sum + echoCountOf(a.id), 0);
  }
  return summary;
}

export function realUnknownSeaSummary(): RealCategorySummary {
  const assets = listUnknownSeaAssets();
  return {
    collectionCount: assets.length > 0 ? 1 : 0,
    videoCount: assets.length,
    echoCount: assets.reduce((sum, asset) => sum + echoCountOf(asset.id), 0),
  };
}

/* ---------- 群岛层：真实合集详情 + 视频岛屿 ---------- */
export interface RealIsland {
  id: string;
  title: string;
  creator: string;
  duration: string;
  cover: string;
  sourceUrl: string;
  coreQuestion: string;
  echoCount: number;
  viewed: boolean;
  isNew: boolean;
  contentRich: boolean;
  mapItem: MapItem;
}

export interface RealCollectionDetail {
  id: string;
  name: string;
  categoryId: string;
  echoCount: number;
  islands: RealIsland[];
  /** 合集级跨视频合成（L6）。未生成/单集合集时为 null。 */
  synthesis: Synthesis | null;
  /** 合集级认知拓展："往旁看"补缺 + 整组之上的延伸。两者门控皆空时为 null。 */
  cognitiveExpansion: CognitiveExpansion | null;
  /** 原合集链接（仅 mix 合集有；自动聚类/未知海域为空串）。 */
  sourceUrl: string;
}

export function realCollectionDetail(collectionId: string): RealCollectionDetail | null {
  if (collectionId === UNKNOWN_SEA_COLLECTION_ID) {
    const assets = listUnknownSeaAssets();
    const islands = assets.map((asset, i): RealIsland => {
      const analysis = getAnalysis(asset.id);
      const { x, y } = slotAt(UNKNOWN_SEA_ISLAND_SLOTS, i);
      return {
        id: asset.id,
        title: asset.title || "未命名视频",
        creator: asset.author,
        duration: asset.duration,
        cover: asset.cover,
        sourceUrl: asset.sourceUrl,
        coreQuestion: analysis?.coreQuestion ?? "",
        echoCount: analysis?.echoes?.length ?? 0,
        viewed: false,
        isNew: isNewAsset(asset),
        contentRich: (analysis?.backbone.length ?? 0) >= 6,
        mapItem: createMapItem({
          id: `island-${asset.id}`,
          entityType: "video",
          entityId: asset.id,
          x,
          y,
          asset: ISLAND_ASSETS[i % ISLAND_ASSETS.length],
          route: `/video/${asset.id}`,
          rotation: ISLAND_ROTATIONS[i % ISLAND_ROTATIONS.length],
          hitBox: { mobileWidth: 116 },
        }),
      };
    });
    return {
      id: UNKNOWN_SEA_COLLECTION_ID,
      name: "未知海域",
      categoryId: "unknown",
      echoCount: islands.reduce((sum, island) => sum + island.echoCount, 0),
      islands,
      synthesis: null,
      cognitiveExpansion: null,
      sourceUrl: "",
    };
  }

  const row = getCollectionRow(collectionId);
  if (!row) return null;
  const assets = listAssetsByCollection(collectionId);
  const islandSlots = row.id === NEW_CHINA_COLLECTION_ID
    ? NEW_CHINA_ISLAND_SLOTS
    : row.id === TWO_JIN_COLLECTION_ID
      ? TWO_JIN_ISLAND_SLOTS
      : row.id === MISC_TECH_COLLECTION_ID
        ? MISC_TECH_ISLAND_SLOTS
        : row.id === MISC_ECO_COLLECTION_ID
          ? MISC_ECO_ISLAND_SLOTS
          : row.id === ECONOMY_SERIES_COLLECTION_ID
            ? ECONOMY_SERIES_ISLAND_SLOTS
          : row.id === FINANCIAL_BUBBLES_COLLECTION_ID
            ? FINANCIAL_BUBBLES_ISLAND_SLOTS
          : row.id === INTERNET_EPIC_COLLECTION_ID
            ? INTERNET_EPIC_ISLAND_SLOTS
        : ISLAND_SLOTS;
  const islands = assets.map((asset, i): RealIsland => {
    const analysis = getAnalysis(asset.id);
    const slot = slotAt(islandSlots, i) as IslandSlot;
    const { x, y } = slot;
    return {
      id: asset.id,
      title: asset.title || "未命名视频",
      creator: asset.author,
      duration: asset.duration,
      cover: asset.cover,
      sourceUrl: asset.sourceUrl,
      coreQuestion: analysis?.coreQuestion ?? "",
      echoCount: analysis?.echoes?.length ?? 0,
      viewed: false, // 观看史 P2 才有；真实视频先按未点亮处理
      isNew: isNewAsset(asset),
      contentRich: (analysis?.backbone.length ?? 0) >= 6,
      mapItem: createMapItem({
        id: `island-${asset.id}`,
        entityType: "video",
        entityId: asset.id,
        x,
        y,
        ...(slot.labelOffset ? { labelOffset: slot.labelOffset } : {}),
        asset: ISLAND_ASSETS[i % ISLAND_ASSETS.length],
        route: `/video/${asset.id}`,
        rotation: ISLAND_ROTATIONS[i % ISLAND_ROTATIONS.length],
        hitBox: { mobileWidth: 116 },
      }),
    };
  });
  const gapFill = getCollectionGapFill(row.id);
  const collectionExtend = getCollectionExtend(row.id);
  // 补缺、延伸任一有内容即渲染认知拓展；voices 恒 0（讨论区 P2 前的种子数）
  const cognitiveExpansion: CognitiveExpansion | null =
    gapFill || collectionExtend.length
      ? {
          gapFill: gapFill
            ? {
                gap: gapFill.gap, fill: gapFill.fill,
                ...(gapFill.focus ? { focus: gapFill.focus } : {}),
                ...(gapFill.searchTerms?.length ? { searchTerms: gapFill.searchTerms } : {}),
              }
            : {},
          extend: collectionExtend.map((x) => ({ ...x, voices: 0 })),
        }
      : null;

  return {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    echoCount: islands.reduce((sum, island) => sum + island.echoCount, 0),
    islands,
    synthesis: getSynthesis(row.id),
    cognitiveExpansion,
    sourceUrl: row.sourceUrl ?? "",
  };
}
