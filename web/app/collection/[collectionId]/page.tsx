import Link from "next/link";
import { notFound } from "next/navigation";
import { getCollection, videosOf } from "@/lib/data";
import { ARCHIPELAGO_SCENES, type MapItem } from "@/lib/map-config";
import { realCollectionDetail, UNKNOWN_SEA_COLLECTION_ID, type RealIsland } from "@/lib/server/real-data";
import { MapStage, type HotspotDef } from "@/components/map/MapStage";
import { ArchipelagoTerrain } from "@/components/map/ArchipelagoTerrain";
import { MapAtlasNav } from "@/components/map/MapChrome";
import RegionWaterCanvas from "@/components/map/RegionWaterCanvas";

export const dynamic = "force-dynamic";

/** 岛屿渲染所需的最小形状：种子 Video 与真实解析视频都折算成它。 */
type IslandDef = Omit<RealIsland, "mapItem" | "cover" | "sourceUrl" | "engagementHeat"> & {
  cover?: string;
  sourceUrl?: string;
  mapItem: MapItem;
};

// ArchipelagoTerrain 的 SVG viewBox（1000×560），排版语言与区域地图一致。
const ARCHIPELAGO_ASPECT_RATIO = 1000 / 560;
// Every island visual is drawn mostly above its map anchor. Compensate at the
// page boundary so both seeded and database-backed archipelagos are centered,
// while hotspots, labels and camera focus continue to share the same anchor.
const ARCHIPELAGO_VISUAL_CENTER_Y_OFFSET = 10;

function centerArchipelagoItem(mapItem: MapItem): MapItem {
  const yOffset = ARCHIPELAGO_VISUAL_CENTER_Y_OFFSET;
  return {
    ...mapItem,
    y: mapItem.y + yOffset,
    position: [mapItem.position[0], mapItem.position[1] + yOffset, mapItem.position[2]],
    labelAnchor: [mapItem.labelAnchor[0], mapItem.labelAnchor[1] + yOffset, mapItem.labelAnchor[2]],
    cameraTarget: {
      ...mapItem.cameraTarget,
      position: [
        mapItem.cameraTarget.position[0],
        mapItem.cameraTarget.position[1] + yOffset,
        mapItem.cameraTarget.position[2],
      ],
      target: [
        mapItem.cameraTarget.target[0],
        mapItem.cameraTarget.target[1] + yOffset,
        mapItem.cameraTarget.target[2],
      ],
    },
  };
}

export default async function ArchipelagoMapPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = await params;

  // 数据源两层：种子合集（c1~c4）优先命中，miss 时查真实解析合集
  const seed = getCollection(collectionId);
  const real = seed ? null : realCollectionDetail(collectionId);
  if (!seed && !real) notFound();

  let islands: IslandDef[];
  if (seed) {
    const itemByEntity = new Map(
      (ARCHIPELAGO_SCENES[collectionId]?.items ?? []).map((item) => [item.entityId, item])
    );
    islands = videosOf(collectionId).flatMap((video) => {
      const mapItem = itemByEntity.get(video.id);
      if (!mapItem) return [];
      return [
        {
          id: video.id,
          title: video.title,
          creator: video.creator,
          duration: video.duration,
          cover: video.cover,
          sourceUrl: video.sourceUrl,
          coreQuestion: video.coreQuestion,
          echoCount: video.nodes.filter((node) => node.echo).length,
          viewed: video.viewed,
          isNew: video.isNew,
          contentRich: video.contentRich,
          commentHeat: null,
          mapItem,
        },
      ];
    });
  } else {
    islands = real!.islands.map((island) => ({
      ...island,
      cover: island.cover || undefined,
      sourceUrl: island.sourceUrl || undefined,
    }));
  }

  islands = islands.map((island) => ({
    ...island,
    mapItem: centerArchipelagoItem(island.mapItem),
  }));

  const collection = seed
    ? { name: seed.name, categoryId: seed.categoryId, echoCount: seed.echoCount, synthesis: !!seed.synthesis }
    : { name: real!.name, categoryId: real!.categoryId, echoCount: real!.echoCount, synthesis: !!real!.synthesis };
  const isUnknownSea = collectionId === UNKNOWN_SEA_COLLECTION_ID;

  const items: HotspotDef[] = islands.map((island) => ({
    id: island.mapItem.id,
    x: island.mapItem.x,
    y: island.mapItem.y,
    title: island.title,
    meta: (
      <>
        {[island.creator, island.duration].filter(Boolean).join(" · ")}
        {island.echoCount > 0 && <span className="gold">✦ {island.echoCount} 回响</span>}
      </>
    ),
    desc: island.coreQuestion,
    cover: island.cover,
    coverAlt: `${island.title} 封面`,
    sourceHref: island.sourceUrl,
    route: island.mapItem.route,
    routeLabel: "进入解析页",
    echo: island.echoCount > 0,
    dim: !island.viewed,
    focusX: island.mapItem.cameraTarget.target[0],
    focusY: island.mapItem.cameraTarget.target[1],
    focusZoom: island.mapItem.cameraTarget.zoom,
    eyebrow: "视频岛屿",
    hitArea: island.mapItem.hitArea,
    hitBox: island.mapItem.hitBox,
  }));

  return (
    <main className="mapPage mapPage--archipelago mapPage--regionAtlas">
      <div className="mapPage__grain" aria-hidden="true" />
      <h1 className="srOnly">{collection.name}群岛</h1>

      <MapAtlasNav href={isUnknownSea ? "/" : `/category/${collection.categoryId}`} />

      <section
        className="mapSceneSection mapSceneSection--regionAtlas"
        aria-label={`${collection.name}群岛地图`}
      >
        <MapStage
          className="mapStage--regionAtlas mapStage--archipelago"
          sceneAspectRatio={ARCHIPELAGO_ASPECT_RATIO}
          fitMode="contain"
          fitPadding={{ desktop: 1, mobile: 0.86 }}
          resetViewOnPanelClose
          lockVisualOnSelection
          discoveryNamespace={`collection:${collectionId}`}
          background={
            <ArchipelagoTerrain
              collectionId={collectionId}
              categoryId={collection.categoryId}
              islands={islands.map((island) => ({
                item: island.mapItem,
                echo: island.echoCount > 0,
                viewed: island.viewed,
                isNew: island.isNew,
                contentRich: island.contentRich,
              }))}
            />
          }
          stageBackground={
            <div className="regionStageWater">
              <RegionWaterCanvas />
            </div>
          }
          items={items}
        />
      </section>

      {collection.synthesis && (
        <Link className="archipelagoSynthesis" href={`/collection/${collectionId}/synthesis`}>
          <span className="archipelagoSynthesis__copy">
            <small>跨视频关系</small>
            <strong>合集解析</strong>
          </span>
          <i aria-hidden="true">↗</i>
        </Link>
      )}

      <div
        className="regionAtlasLocator"
        aria-label={`${collection.name}群岛，共 ${islands.length} 座视频岛屿，${collection.echoCount} 次回响`}
      >
        <span>ARCHIPELAGO · {islands.length} ISLANDS</span>
        <strong>{collection.name}</strong>
        <i aria-hidden="true" />
      </div>
    </main>
  );
}
