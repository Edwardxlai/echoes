"use client";

import { useContext } from "react";
import type { MapItem } from "@/lib/map-config";
import { Mountain, Tree, TreeCluster } from "./TerrainDetails";
import { LandmarkGlyph, type GlyphKind } from "./LandmarkGlyph";
import { MapActiveContext, MapDiscoveryContext } from "./MapStage";
import { assignIslandArt, NEW_CHINA_ISLANDS, type IslandArt } from "./island-art";

const ISLAND_TOPS = [
  "M-56-43C-57-62-38-75-18-73C-4-88 23-85 35-69C52-66 63-50 57-35C66-21 50-9 34-11C20 1-2-2-12-14C-31-8-50-20-48-34C-57-34-62-38-56-43Z",
  "M-53-48C-48-69-27-80-8-74C6-88 31-78 37-63C55-58 61-40 52-27C57-14 41-5 27-12C14-2-6-6-13-19C-31-12-51-24-48-39C-56-40-59-44-53-48Z",
  "M-58-39C-61-57-42-72-24-69C-10-84 17-82 30-66C47-67 61-54 57-39C67-27 55-12 39-13C28-1 5-3-5-14C-22-6-44-15-45-30C-55-29-62-33-58-39Z",
];

const ISLAND_INNERS = [
  "M-44-43C-43-59-28-67-13-65C0-76 20-73 29-60C42-57 49-46 45-35C50-24 37-17 25-20C13-11-4-14-10-24C-25-17-39-26-37-37Z",
  "M-40-47C-36-61-20-68-7-63C5-73 22-65 27-54C39-50 44-39 37-30C40-21 29-16 20-21C10-14-3-17-8-26C-21-21-36-29-33-39Z",
  "M-44-38C-45-52-31-62-17-58C-7-70 13-68 23-55C36-56 46-47 42-36C50-28 39-19 28-21C19-12 3-15-4-23C-17-16-33-23-33-33Z",
];

const TOP_COLORS = ["#c9ddc7", "#cbd9eb", "#ddd0e6"];
const SIDE_COLORS = ["#9caf9e", "#a8b6c5", "#b6a8ba"];
const ISLAND_SCALES = [1.25, 1.14, 1.2];

const NEW_CHINA_COLLECTION_ID = "07ae1f5b";

/* 岛屿资源的专属映射与类目资源池都在 island-art.ts；
   这里只保留新中国系列的槽位取岛和渲染逻辑。
   资源池未覆盖的类目（soc/sci 等）继续使用通用岛体。 */
const ISLAND_GLYPH_KINDS: GlyphKind[] = ["city", "tower", "ruins", "port"];

function IslandLandmark({ variant }: { variant: number }) {
  const kind = ISLAND_GLYPH_KINDS[variant % ISLAND_GLYPH_KINDS.length];
  return (
    <g transform="translate(-26 -68) scale(0.48)">
      <LandmarkGlyph kind={kind} accent="var(--map-ink-soft)" />
    </g>
  );
}

function NewChinaIsland({ index }: { index: number }) {
  const island = NEW_CHINA_ISLANDS[index % NEW_CHINA_ISLANDS.length];
  return (
    <image
      className="island__newChinaArt"
      href={island.href}
      x={-88}
      y={-117.33}
      width={176}
      height={117.33}
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{island.label}</title>
    </image>
  );
}

/* 经济岛、我的岛屿为方形构图（原始美术就是 1:1），其余类目为 3:2 横构图。 */
function ArtIsland({ art, categoryId }: { art: IslandArt; categoryId: string }) {
  const square = categoryId === "eco" || categoryId === "personal";
  const artClass = categoryId === "eco"
    ? "economy"
    : categoryId === "tech"
      ? "technology"
      : categoryId === "life"
        ? "daily"
      : categoryId === "unknown"
        ? "unknown"
        : categoryId === "personal"
          ? "personal"
          : "history";
  return (
    <image
      className={`island__${artClass}Art`}
      href={art.href}
      x={-88}
      y={square ? -154 : -117.33}
      width={176}
      height={square ? 176 : 117.33}
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{art.label}</title>
    </image>
  );
}

function IslandVisual({
  variant,
  isNew,
  newChinaIndex,
  art,
  categoryId,
}: {
  variant: number;
  isNew: boolean;
  newChinaIndex?: number;
  art?: IslandArt;
  categoryId: string;
}) {
  if (newChinaIndex !== undefined || art !== undefined) {
    return (
      <g>
        {newChinaIndex !== undefined ? <NewChinaIsland index={newChinaIndex} /> : null}
        {art !== undefined ? <ArtIsland art={art} categoryId={categoryId} /> : null}
        {isNew ? (
          <g transform="translate(-54 -72)" stroke="var(--map-region-eco-line)" strokeWidth={1.5} strokeLinecap="round">
            <path d="M0 12V0m0 5-7-5m7 8 8-5" />
            <path d="M-7 0c5-1 7 1 7 5-5 1-7-1-7-5Zm15 3c-5-1-7 1-8 5 5 1 7-1 8-5Z" fill="#b8d1b7" stroke="none" />
          </g>
        ) : null}
      </g>
    );
  }

  const top = ISLAND_TOPS[variant];
  const topColor = TOP_COLORS[variant];
  const sideColor = SIDE_COLORS[variant];
  return (
    <g>
      <ellipse className="terrain-shadow" cx={5} cy={1} rx={56} ry={9} />
      <path d={top} transform="translate(0 11)" fill="#d7ccb7" opacity={0.78} />
      <path d={top} transform="translate(0 7)" fill={sideColor} opacity={0.92} />
      <path d={top} fill="var(--map-sand)" />
      <path d={ISLAND_INNERS[variant]} fill={topColor} opacity={0.9} />
      <path d={top} fill="none" stroke="#fffdf5" strokeWidth={1.7} opacity={0.68} />
      <path d="M-42-21C-17-11 11-13 40-24" fill="none" stroke="#9b937e" strokeWidth={1.1} opacity={0.26} />

      {variant === 0 ? (
        <>
          <TreeCluster x={-34} y={-32} scale={0.42} />
          <Mountain x={34} y={-42} scale={0.38} face="#ecebe2" shade="#b9c2bb" />
        </>
      ) : null}
      {variant === 1 ? (
        <>
          <Mountain x={-33} y={-42} scale={0.46} face="#edf0ed" shade="#b8c4c6" />
          <Tree x={35} y={-26} scale={0.55} light="#9bb3a5" dark="#789187" />
        </>
      ) : null}
      {variant === 2 ? (
        <>
          <TreeCluster x={37} y={-33} scale={0.4} light="#b4b39d" dark="#8b8e79" />
          <path d="M-40-35c12-9 22-10 32-3" fill="none" stroke="#b39cc9" strokeWidth={1.4} opacity={0.5} />
        </>
      ) : null}

      <IslandLandmark variant={variant} />
      {isNew ? (
        <g transform="translate(-38 -57)" stroke="var(--map-region-eco-line)" strokeWidth={1.5} strokeLinecap="round">
          <path d="M0 12V0m0 5-7-5m7 8 8-5" />
          <path d="M-7 0c5-1 7 1 7 5-5 1-7-1-7-5Zm15 3c-5-1-7 1-8 5 5 1 7-1 8-5Z" fill="#b8d1b7" stroke="none" />
        </g>
      ) : null}
    </g>
  );
}

export function ArchipelagoTerrain({ collectionId, categoryId, islands }: {
  collectionId: string;
  categoryId: string;
  islands: { item: MapItem; echo: boolean; viewed?: boolean; isNew?: boolean; contentRich?: boolean }[];
}) {
  const activeId = useContext(MapActiveContext);
  const discovery = useContext(MapDiscoveryContext);
  const usesNewChinaIslandArt = collectionId === NEW_CHINA_COLLECTION_ID;
  const usesInternetEpicLayout = collectionId === "b9702449";
  const artByEntity = usesNewChinaIslandArt
    ? new Map<string, IslandArt>()
    : assignIslandArt(categoryId, islands.map(({ item }) => item.entityId));
  if (usesInternetEpicLayout && islands[5]) {
    artByEntity.set(islands[5].item.entityId, {
      href: "/map-runtime/archipelago/economy/b9702449/islands/economy_b9702449_island_150bd446_lod1_v01.webp",
      label: "互联网工业岛",
    });
  }

  return (
    <svg
      viewBox="0 0 1000 560"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      pointerEvents="none"
    >
      {/* 不再画一整块带圆角的不透明水面——外层 .mapStage--regionAtlas 的
          真实水面贴图才是"海"，这里只叠一层柔和的深浅渐变，让岛屿像
          嵌进水里而不是贴在一张卡片上。 */}
      {islands.map(({ item, viewed = true, isNew = false, contentRich = false }, i) => {
        const unviewed = !viewed;
        const isActive = activeId === item.id;
        const isRevealing = discovery.revealingIds.has(item.id);
        const isDiscovered = !discovery.enabled || discovery.discoveredIds.has(item.id);
        const isDiscoveryHidden =
          discovery.enabled && (!discovery.ready || (!isDiscovered && !isRevealing));
        const variant = i % ISLAND_TOPS.length;
        const art = artByEntity.get(item.entityId);
        const usesCustomIslandArt = usesNewChinaIslandArt || art !== undefined;
        const isEconomyArt = art !== undefined && categoryId === "eco";
        const isTechnologyArt = art !== undefined && categoryId === "tech";
        const isDailyArt = art !== undefined && categoryId === "life";
        const isUnknownArt = art !== undefined && categoryId === "unknown";
        const isPersonalArt = art !== undefined && categoryId === "personal";
        const isHistoryArt =
          art !== undefined && !isEconomyArt && !isTechnologyArt && !isDailyArt && !isUnknownArt && !isPersonalArt;
        const hierarchyScale =
          isEconomyArt
            ? [1.16, 1.06, 1.06, 0.96, 0.96, 0.9, 0.9][i] ?? 0.88
            : 1;
        const scale = usesCustomIslandArt
          ? 1.12 * hierarchyScale * ((isEconomyArt || isTechnologyArt || isDailyArt) && contentRich ? 1.08 : 1)
          : ISLAND_SCALES[variant] * (contentRich ? 1.12 : 1);
        const layoutScale = usesInternetEpicLayout ? 0.88 : 1;

        return (
          <g key={item.id} transform={`translate(${item.x * 10} ${item.y * 5.6 + 2}) scale(${scale * layoutScale})`}>
            <g
              className={`island${usesNewChinaIslandArt ? " island--newChina" : ""}${isEconomyArt ? " island--economy" : ""}${isTechnologyArt ? " island--technology" : ""}${isDailyArt ? " island--daily" : ""}${isHistoryArt ? " island--history" : ""}${isUnknownArt ? " island--unknown" : ""}${isPersonalArt ? " island--personal" : ""}${unviewed ? " is-unviewed" : ""}${isNew ? " is-new" : ""}${
                isActive ? " is-active" : ""
              }${isRevealing && !usesNewChinaIslandArt ? " is-discovering" : ""}${
                isDiscoveryHidden ? " is-discovery-hidden" : ""
              }`}
            >
              <IslandVisual
                variant={variant}
                isNew={isNew}
                newChinaIndex={usesNewChinaIslandArt ? i : undefined}
                art={art}
                categoryId={categoryId}
              />
            </g>
          </g>
        );
      })}

    </svg>
  );
}
