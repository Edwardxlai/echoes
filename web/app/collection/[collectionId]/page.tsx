import Link from "next/link";
import { notFound } from "next/navigation";
import { getCollection, videosOf } from "@/lib/data";
import { ARCHIPELAGO_SCENES, type MapItem } from "@/lib/map-config";
import { realCollectionDetail, type RealIsland } from "@/lib/server/real-data";
import { MapStage, type HotspotDef } from "@/components/map/MapStage";
import { ArchipelagoTerrain } from "@/components/map/ArchipelagoTerrain";
import { MapKicker, MapStat, MapTopbar } from "@/components/map/MapChrome";

export const dynamic = "force-dynamic";

/** 岛屿渲染所需的最小形状：种子 Video 与真实解析视频都折算成它。 */
type IslandDef = Omit<RealIsland, "mapItem" | "cover" | "sourceUrl"> & {
  cover?: string;
  sourceUrl?: string;
  mapItem: MapItem;
};

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

  const collection = seed
    ? { name: seed.name, categoryId: seed.categoryId, echoCount: seed.echoCount, synthesis: !!seed.synthesis }
    : { name: real!.name, categoryId: real!.categoryId, echoCount: real!.echoCount, synthesis: false };

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

  const viewedCount = islands.filter((island) => island.viewed).length;

  return (
    <main className="mapPage mapPage--archipelago">
      <div className="mapPage__grain" aria-hidden="true" />
      <div className="mapShell mapShell--inner">
        <MapTopbar
          backHref={`/category/${collection.categoryId}`}
          backLabel="返回区域地图"
          status={`${islands.length} 座视频岛屿 · ${collection.echoCount} 次回响`}
        />

        <header className="mapIntro mapIntro--collection">
          <div className="mapIntro__copy">
            <MapKicker index="03">一组视频，被整理成一片可以反复进入的群岛</MapKicker>
            <h1>{collection.name}</h1>
            <p>每座岛屿是一条视频。雾中的还未看过，金色信标说明它正在与你过去看过的内容发生联系。</p>
          </div>

          <div className="collectionActions">
            <div className="mapStats mapStats--inner" aria-label="合集概况">
              <MapStat value={islands.length} label="视频岛屿" />
              <MapStat value={`${viewedCount}/${islands.length}`} label="已经点亮" />
              <MapStat value={collection.echoCount} label="回响连接" />
            </div>
            {collection.synthesis && (
              <Link className="synthesisLink" href={`/collection/${collectionId}/synthesis`}>
                <span>
                  <small>跨视频关系</small>
                  看全貌
                </span>
                <i aria-hidden="true">↗</i>
              </Link>
            )}
          </div>
        </header>
      </div>

      <section className="mapSceneSection" aria-label={`${collection.name}群岛地图`}>
        <div className="mapSceneSection__caption">
          <span>ARCHIPELAGO / {collectionId.toUpperCase()}</span>
          <p>选中岛屿，先看核心问题，再决定是否进入解析</p>
        </div>
        <MapStage
          background={
            <ArchipelagoTerrain
              islands={islands.map((island) => ({
                item: island.mapItem,
                echo: island.echoCount > 0,
                viewed: island.viewed,
                isNew: island.isNew,
                contentRich: island.contentRich,
              }))}
            />
          }
          items={items}
        />
      </section>

      <footer className="mapLegend mapShell" aria-label="岛屿状态说明">
        <span><i className="legendMark legendMark--viewed" />已经观看</span>
        <span><i className="legendMark legendMark--unviewed" />还未观看</span>
        <span><i className="legendMark legendMark--echo" />正在回响</span>
        <span><i className="legendMark legendMark--new" />最近新增</span>
      </footer>
    </main>
  );
}
