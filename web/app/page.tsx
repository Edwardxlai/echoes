import Link from "next/link";
import { CATEGORY_LIST, COLLECTIONS, ECHO_FEED, VIDEOS } from "@/lib/data";
import { WORLD_SCENE } from "@/lib/map-config";
import { MapStage, type HotspotDef } from "@/components/map/MapStage";
import { WorldTerrain } from "@/components/map/WorldTerrain";
import { HeroInput } from "@/components/map/HeroInput";
import { MapKicker, MapStat, MapTopbar } from "@/components/map/MapChrome";

export default function WorldMapPage() {
  const itemByEntity = new Map(WORLD_SCENE.items.map((item) => [item.entityId, item]));
  const items: HotspotDef[] = CATEGORY_LIST.flatMap((category) => {
    const mapItem = itemByEntity.get(category.id);
    if (!mapItem) return [];

    const collections = category.collectionIds.map((id) => COLLECTIONS[id]).filter(Boolean);
    const videoCount = collections.reduce((sum, collection) => sum + collection.videoIds.length, 0);

    return [
      {
        id: mapItem.id,
        x: mapItem.x,
        y: mapItem.y,
        title: category.name,
        meta: (
          <>
            {category.collectionIds.length} 个合集 · {videoCount} 条视频
            {category.echoCount > 0 && <span className="gold">✦ {category.echoCount} 回响</span>}
          </>
        ),
        desc: `沿着「${category.name}」区域的地标继续深入，查看已经被整理成空间记忆的合集。`,
        route: mapItem.route,
        routeLabel: `进入${category.name}区域`,
        echo: category.echoCount > 0,
        focusX: mapItem.cameraTarget.target[0],
        focusY: mapItem.cameraTarget.target[1],
        focusZoom: mapItem.cameraTarget.zoom,
        eyebrow: "内容大类",
        accessibleLabel: `${category.name}，${category.collectionIds.length} 个合集，${videoCount} 条视频，${category.echoCount} 次回响`,
        hitArea: mapItem.hitArea,
        hitPath: mapItem.hitPath,
        hitBox: mapItem.hitBox,
      },
    ];
  });

  const collectionCount = Object.keys(COLLECTIONS).length;
  const videoCount = Object.keys(VIDEOS).length;
  const echoCount = CATEGORY_LIST.reduce((sum, category) => sum + category.echoCount, 0);
  const latestEcho = ECHO_FEED[0]!;

  return (
    <main className="mapPage mapPage--world">
      <div className="mapPage__grain" aria-hidden="true" />
      <div className="mapShell mapShell--hero">
        <MapTopbar status={`${CATEGORY_LIST.length} 个知识区域 · ${echoCount} 次回响`} />

        <section className="worldHero" aria-labelledby="world-title">
          <div className="worldHero__copy">
            <MapKicker index="01">你的私人观看史，正在重新连接</MapKicker>
            <h1 id="world-title">
              <span>让看过的，</span>
              <em>彼此回响</em>
            </h1>
            <p>把一条线性视频，接进一张可以探索、可以返回、会随你持续生长的知识地图。</p>
          </div>

          <div className="worldHero__action">
            <HeroInput />
            <div className="mapStats" aria-label="知识库概况">
              <MapStat value={CATEGORY_LIST.length} label="知识区域" />
              <MapStat value={collectionCount} label="主题合集" />
              <MapStat value={videoCount} label="已解析视频" />
            </div>
            <Link className="worldHero__liveEcho" href={`/video/${latestEcho.videoId}`}>
              <span>✦ 最新回响</span>
              <strong>《{latestEcho.a}》</strong>
              <i>{latestEcho.relation}</i>
              <strong>《{latestEcho.b}》</strong>
              <b aria-hidden="true">↗</b>
            </Link>
          </div>
        </section>
      </div>

      <section className="mapSceneSection" aria-label="世界地图">
        <div className="mapSceneSection__caption">
          <span>WORLD / 01</span>
          <p>拖动探索 · 滚轮缩放 · 选择区域后确认进入</p>
        </div>
        <MapStage
          background={<WorldTerrain />}
          items={items}
          className="mapStage--worldRaster"
          storageRevision="world-raster-v1"
          sceneAspectRatio={1586 / 992}
          lockVisualOnSelection
        />
      </section>

      <section className="worldSignals mapShell" aria-label="最近动态">
        <div className="worldSignals__echoes">
          <div className="sectionLabel">
            <span className="sectionLabel__spark">✦</span>
            <div>
              <strong>最近的回响</strong>
              <span>你看过的这些，最近在别处响了</span>
            </div>
            <span className="sectionLabel__count">{String(ECHO_FEED.length).padStart(2, "0")}</span>
          </div>
          <div className="echoFeed">
            {ECHO_FEED.map((feed, index) => (
              <Link key={feed.videoId} className="echoFeed__row" href={`/video/${feed.videoId}`}>
                <span className="echoFeed__index">{String(index + 1).padStart(2, "0")}</span>
                <b>《{feed.a}》</b>
                <span className="rel">{feed.relation}</span>
                <span>《{feed.b}》</span>
                <span className="echoFeed__arrow" aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </div>

        <aside className="worldSignals__recent" aria-label="最近进入">
          <div className="sectionLabel sectionLabel--compact">
            <div>
              <strong>最近进入</strong>
              <span>空间位置固定，下次仍从这里继续</span>
            </div>
          </div>
          {Object.values(COLLECTIONS)
            .slice(0, 3)
            .map((collection) => (
              <Link key={collection.id} href={`/collection/${collection.id}`} className="recentPlace">
                <span className="recentPlace__terrain" aria-hidden="true" />
                <span>
                  <strong>{collection.name}</strong>
                  <small>{collection.videoIds.length} 座视频岛屿</small>
                </span>
                <i aria-hidden="true">→</i>
              </Link>
            ))}
        </aside>
      </section>
    </main>
  );
}
