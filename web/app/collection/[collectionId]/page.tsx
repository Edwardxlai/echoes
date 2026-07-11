import Link from "next/link";
import { notFound } from "next/navigation";
import { getCollection, videosOf } from "@/lib/data";
import { ARCHIPELAGO_SCENES } from "@/lib/map-config";
import { MapStage, type HotspotDef } from "@/components/map/MapStage";
import { ArchipelagoTerrain } from "@/components/map/ArchipelagoTerrain";
import { MapKicker, MapStat, MapTopbar } from "@/components/map/MapChrome";

export default async function ArchipelagoMapPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = await params;
  const collection = getCollection(collectionId);
  if (!collection) notFound();

  const videos = videosOf(collectionId);
  const islandItems = ARCHIPELAGO_SCENES[collectionId]?.items ?? [];
  const itemByEntity = new Map(islandItems.map((item) => [item.entityId, item]));
  const echoCountOf = (videoId: string) =>
    videos.find((video) => video.id === videoId)?.nodes.filter((node) => node.echo).length ?? 0;

  const items: HotspotDef[] = videos.flatMap((video) => {
    const mapItem = itemByEntity.get(video.id);
    if (!mapItem) return [];
    const echoCount = echoCountOf(video.id);

    return [
      {
        id: mapItem.id,
        x: mapItem.x,
        y: mapItem.y,
        title: video.title,
        meta: (
          <>
            {video.creator} · {video.duration}
            {echoCount > 0 && <span className="gold">✦ {echoCount} 回响</span>}
          </>
        ),
        desc: video.coreQuestion,
        route: mapItem.route,
        routeLabel: "进入解析页",
        echo: echoCount > 0,
        dim: !video.viewed,
        focusX: mapItem.cameraTarget.target[0],
        focusY: mapItem.cameraTarget.target[1],
        focusZoom: mapItem.cameraTarget.zoom,
        eyebrow: "视频岛屿",
        hitArea: mapItem.hitArea,
        hitBox: mapItem.hitBox,
      },
    ];
  });

  const viewedCount = videos.filter((video) => video.viewed).length;

  return (
    <main className="mapPage mapPage--archipelago">
      <div className="mapPage__grain" aria-hidden="true" />
      <div className="mapShell mapShell--inner">
        <MapTopbar
          backHref={`/category/${collection.categoryId}`}
          backLabel="返回区域地图"
          status={`${videos.length} 座视频岛屿 · ${collection.echoCount} 次回响`}
        />

        <header className="mapIntro mapIntro--collection">
          <div className="mapIntro__copy">
            <MapKicker index="03">一组视频，被整理成一片可以反复进入的群岛</MapKicker>
            <h1>{collection.name}</h1>
            <p>每座岛屿是一条视频。雾中的还未看过，金色信标说明它正在与你过去看过的内容发生联系。</p>
          </div>

          <div className="collectionActions">
            <div className="mapStats mapStats--inner" aria-label="合集概况">
              <MapStat value={videos.length} label="视频岛屿" />
              <MapStat value={`${viewedCount}/${videos.length}`} label="已经点亮" />
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
          <span>ARCHIPELAGO / {collection.id.toUpperCase()}</span>
          <p>选中岛屿，先看核心问题，再决定是否进入解析</p>
        </div>
        <MapStage
          background={
            <ArchipelagoTerrain
              islands={islandItems.map((mapItem) => ({
                item: mapItem,
                echo: echoCountOf(mapItem.entityId) > 0,
                viewed: videos.find((video) => video.id === mapItem.entityId)?.viewed ?? false,
                isNew: videos.find((video) => video.id === mapItem.entityId)?.isNew ?? false,
                contentRich: videos.find((video) => video.id === mapItem.entityId)?.contentRich ?? false,
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
