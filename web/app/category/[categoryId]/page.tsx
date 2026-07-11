import { notFound } from "next/navigation";
import { collectionsOf, getCategory } from "@/lib/data";
import { REGION_SCENES } from "@/lib/map-config";
import { MapStage, type HotspotDef } from "@/components/map/MapStage";
import { RegionTerrain } from "@/components/map/RegionTerrain";
import { MapKicker, MapStat, MapTopbar } from "@/components/map/MapChrome";

const REGION_COPY: Record<string, { eyebrow: string; description: string }> = {
  eco: {
    eyebrow: "制度、市场与每个人的选择",
    description: "从城市、港口与中央塔楼之间穿行。每一处地标，都是一组彼此补充或互相争论的经济问题。",
  },
  his: {
    eyebrow: "叙事、证据与被重写的记忆",
    description: "沿着遗迹与旧路进入不同史料现场。地图保存的不是年代，而是你曾追问过的解释。",
  },
  tech: {
    eyebrow: "工具、浪潮与正在变化的工作",
    description: "研究所、港口与制造区彼此连接。每个合集对应一条技术影响现实生活的观察路径。",
  },
};

export default async function RegionMapPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  const category = getCategory(categoryId);
  if (!category) notFound();

  const collections = collectionsOf(categoryId);
  const scene = REGION_SCENES[categoryId];
  const regionItems = scene?.items ?? [];
  const itemByEntity = new Map(regionItems.map((item) => [item.entityId, item]));
  const copy = REGION_COPY[categoryId] ?? {
    eyebrow: "被整理成空间的主题合集",
    description: "每一处地标都通向一组视频，位置固定，方便你再次回来。",
  };

  const items: HotspotDef[] = collections.flatMap((collection) => {
    const mapItem = itemByEntity.get(collection.id);
    if (!mapItem) return [];

    return [
      {
        id: mapItem.id,
        x: mapItem.x,
        y: mapItem.y,
        title: collection.name,
        meta: (
          <>
            {collection.videoIds.length} 集
            {collection.echoCount > 0 && <span className="gold">✦ {collection.echoCount} 回响</span>}
          </>
        ),
        desc: `${collection.terrain}。进入群岛查看每一条视频，或先看这组内容的整体关系。`,
        route: mapItem.route,
        routeLabel: "进入群岛",
        secondaryRoute: collection.synthesis ? `${mapItem.route}/synthesis` : undefined,
        secondaryLabel: "看全貌",
        echo: collection.echoCount > 0,
        focusX: mapItem.cameraTarget.target[0],
        focusY: mapItem.cameraTarget.target[1],
        focusZoom: mapItem.cameraTarget.zoom,
        eyebrow: "主题地标",
        hitArea: mapItem.hitArea,
        hitBox: mapItem.hitBox,
      },
    ];
  });

  const videoCount = collections.reduce((sum, collection) => sum + collection.videoIds.length, 0);

  return (
    <main className={`mapPage mapPage--region mapPage--${categoryId}`}>
      <div className="mapPage__grain" aria-hidden="true" />
      <div className="mapShell mapShell--inner">
        <MapTopbar backHref="/" backLabel="返回世界地图" status={`${collections.length} 个地标 · ${category.echoCount} 次回响`} />

        <header className="mapIntro">
          <div className="mapIntro__copy">
            <MapKicker index="02">{copy.eyebrow}</MapKicker>
            <h1>{category.name}<em>知识区域</em></h1>
            <p>{copy.description}</p>
          </div>
          <div className="mapStats mapStats--inner" aria-label="区域概况">
            <MapStat value={collections.length} label="主题地标" />
            <MapStat value={videoCount} label="视频岛屿" />
            <MapStat value={category.echoCount} label="回响连接" />
          </div>
        </header>
      </div>

      <section className="mapSceneSection" aria-label={`${category.name}区域地图`}>
        <div className="mapSceneSection__caption">
          <span>REGION / {category.id.toUpperCase()}</span>
          <p>地貌不是分类标签，而是帮助你记住内容位置的空间线索</p>
        </div>
        <MapStage
          background={
            <RegionTerrain
              categoryId={categoryId}
              landmarks={regionItems.flatMap((mapItem) => {
                const collection = collections.find((item) => item.id === mapItem.entityId);
                return collection ? [{ item: mapItem, glyphKind: collection.glyphKind }] : [];
              })}
            />
          }
          items={items}
        />
      </section>

      <footer className="mapLegend mapShell" aria-label="地图说明">
        <span><i className="legendMark legendMark--echo" />有回响</span>
        <span><i className="legendMark legendMark--route" />合集之间的知识路径</span>
        <span><i className="legendMark legendMark--landmark" />可进入地标</span>
      </footer>
    </main>
  );
}
