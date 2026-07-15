/* ================================================================
   回响 · 真实解析数据 → 地图三层可渲染形状（服务端专用）
   坐标规则：槽位表按 createdAt 顺序分配——数据不删不改就永远落同一格，
   守住"多次进入位置一致"的固定策展红线（PRD §5.2.2）。
   种子数据（lib/data.ts）在地图上让位给真实数据，详情页仍可直链访问。
   ================================================================ */
import { createMapItem, type MapItem } from "@/lib/map-config";
import {
  listCollections, listAssetsByCollection, getCollectionRow, getAnalysis, getSynthesis,
  type CollectionRow, type SourceAsset,
} from "./store";
import type { Synthesis } from "@/lib/data";

export { hasRealMapContent } from "./store";

/* ---------- 槽位表（舞台 0~100 百分比坐标，避开边缘与信息面板） ---------- */
const REGION_SLOTS = [
  { x: 34, y: 48 }, { x: 66, y: 56 }, { x: 50, y: 30 }, { x: 28, y: 68 },
  { x: 72, y: 34 }, { x: 46, y: 72 }, { x: 60, y: 44 }, { x: 38, y: 26 },
];
const ISLAND_SLOTS = [
  { x: 30, y: 44 }, { x: 60, y: 32 }, { x: 72, y: 62 }, { x: 44, y: 60 },
  { x: 54, y: 42 }, { x: 26, y: 28 }, { x: 78, y: 38 }, { x: 38, y: 76 },
  { x: 64, y: 74 }, { x: 20, y: 58 }, { x: 50, y: 22 }, { x: 80, y: 52 },
];
/** 槽位用尽后的确定性兜底：由下标推位置，仍然稳定。 */
const slotAt = (slots: { x: number; y: number }[], i: number) =>
  slots[i] ?? { x: 16 + ((i * 37) % 68), y: 18 + ((i * 53) % 62) };

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
}

function toLandmark(row: CollectionRow, index: number): RealLandmark {
  const assets = listAssetsByCollection(row.id);
  const { x, y } = slotAt(REGION_SLOTS, index);
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
    mapItem: createMapItem({
      id: `landmark-${row.id}`,
      entityType: "collection",
      entityId: row.id,
      x,
      y,
      asset: `landmark/${glyphKind}`,
      route: `/collection/${row.id}`,
    }),
  };
}

export function realCollectionsOf(categoryId: string): RealLandmark[] {
  return listCollections(categoryId).map(toLandmark);
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
}

export function realCollectionDetail(collectionId: string): RealCollectionDetail | null {
  const row = getCollectionRow(collectionId);
  if (!row) return null;
  const assets = listAssetsByCollection(collectionId);
  const islands = assets.map((asset, i): RealIsland => {
    const analysis = getAnalysis(asset.id);
    const { x, y } = slotAt(ISLAND_SLOTS, i);
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
        asset: ISLAND_ASSETS[i % ISLAND_ASSETS.length],
        route: `/video/${asset.id}`,
        rotation: ISLAND_ROTATIONS[i % ISLAND_ROTATIONS.length],
        hitBox: { mobileWidth: 116 },
      }),
    };
  });
  return {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    echoCount: islands.reduce((sum, island) => sum + island.echoCount, 0),
    islands,
    synthesis: getSynthesis(row.id),
  };
}
