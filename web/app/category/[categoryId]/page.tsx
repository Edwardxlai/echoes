import { notFound } from "next/navigation";
import { collectionsOf, getCategory } from "@/lib/data";
import { REGION_SCENES, type MapItem } from "@/lib/map-config";
import { hasRealMapContent, realCollectionsOf } from "@/lib/server/real-data";
import { MapStage, type HotspotDef } from "@/components/map/MapStage";
import { RegionTerrain } from "@/components/map/RegionTerrain";
import { MapKicker, MapReturnControl, MapStat, MapTopbar } from "@/components/map/MapChrome";

export const dynamic = "force-dynamic";

/** 地标渲染所需的最小形状：种子 Collection 与真实解析合集都折算成它。 */
interface LandmarkDef {
  id: string;
  name: string;
  videoCount: number;
  echoCount: number;
  terrain: string;
  glyphKind: "city" | "tower" | "ruins" | "port";
  mapItem: MapItem;
  synthesisRoute?: string;
}

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

  const scene = REGION_SCENES[categoryId];
  const copy = REGION_COPY[categoryId] ?? {
    eyebrow: "被整理成空间的主题合集",
    description: "每一处地标都通向一组视频，位置固定，方便你再次回来。",
  };

  // 有真实解析内容时地图展示真实合集；否则落种子数据
  let landmarks: LandmarkDef[];
  if (hasRealMapContent()) {
    landmarks = realCollectionsOf(categoryId).map((real) => ({
      id: real.id,
      name: real.name,
      videoCount: real.videoCount,
      echoCount: real.echoCount,
      terrain: real.terrain,
      glyphKind: real.glyphKind,
      mapItem: real.mapItem,
    }));
  } else {
    const seedItems = new Map((scene?.items ?? []).map((item) => [item.entityId, item]));
    landmarks = collectionsOf(categoryId).flatMap((collection) => {
      const mapItem = seedItems.get(collection.id);
      if (!mapItem) return [];
      return [
        {
          id: collection.id,
          name: collection.name,
          videoCount: collection.videoIds.length,
          echoCount: collection.echoCount,
          terrain: collection.terrain,
          glyphKind: collection.glyphKind,
          mapItem,
          synthesisRoute: collection.synthesis ? `${mapItem.route}/synthesis` : undefined,
        },
      ];
    });
  }

  const items: HotspotDef[] = landmarks.map((landmark) => ({
    id: landmark.mapItem.id,
    x: landmark.mapItem.x,
    y: landmark.mapItem.y,
    title: landmark.name,
    meta: (
      <>
        {landmark.videoCount} 集
        {landmark.echoCount > 0 && <span className="gold">✦ {landmark.echoCount} 回响</span>}
      </>
    ),
    desc: `${landmark.terrain}。进入群岛查看每一条视频，或先看这组内容的整体关系。`,
    route: landmark.mapItem.route,
    routeLabel: "进入群岛",
    secondaryRoute: landmark.synthesisRoute,
    secondaryLabel: landmark.synthesisRoute ? "看全貌" : undefined,
    echo: landmark.echoCount > 0,
    focusX: landmark.mapItem.cameraTarget.target[0],
    focusY: landmark.mapItem.cameraTarget.target[1],
    focusZoom: categoryId === "eco" ? 1.12 : landmark.mapItem.cameraTarget.zoom,
    eyebrow: "主题地标",
    hitArea: landmark.mapItem.hitArea,
    hitBox: landmark.mapItem.hitBox,
  }));

  const videoCount = landmarks.reduce((sum, landmark) => sum + landmark.videoCount, 0);
  const echoTotal = landmarks.reduce((sum, landmark) => sum + landmark.echoCount, 0);

  if (categoryId === "eco") {
    return (
      <main className="mapPage mapPage--region mapPage--eco mapPage--regionAtlas">
        <div className="mapPage__grain" aria-hidden="true" />
        <h1 className="srOnly">{category.name}知识区域</h1>

        <MapReturnControl href="/" label="世界地图" />

        <section
          className="mapSceneSection mapSceneSection--regionAtlas"
          aria-label={`${category.name}区域地图`}
        >
          <MapStage
            className="mapStage--regionAtlas"
            storageRevision="economy-atlas-v2"
            initialZoom={0.9}
            sceneAspectRatio={1000 / 560}
            fitMode="contain"
            fitPadding={{ desktop: 0.9, mobile: 0.84 }}
            resetViewOnPanelClose
            lockVisualOnSelection
            background={
              <RegionTerrain
                categoryId={categoryId}
                landmarks={landmarks.map((landmark) => ({
                  item: landmark.mapItem,
                  glyphKind: landmark.glyphKind,
                }))}
              />
            }
            items={items}
          />
        </section>

        <div className="regionAtlasLocator" aria-label={`${category.name}区域，共 ${landmarks.length} 处地标`}>
          <span>REGION 01</span>
          <strong>{category.name}区域</strong>
          <i aria-hidden="true" />
        </div>
      </main>
    );
  }

  return (
    <main className={`mapPage mapPage--region mapPage--${categoryId}`}>
      <div className="mapPage__grain" aria-hidden="true" />
      <div className="mapShell mapShell--inner">
        <MapTopbar backHref="/" backLabel="返回世界地图" status={`${landmarks.length} 个地标 · ${echoTotal} 次回响`} />

        <header className="mapIntro">
          <div className="mapIntro__copy">
            <MapKicker index="02">{copy.eyebrow}</MapKicker>
            <h1>{category.name}<em>知识区域</em></h1>
            <p>{copy.description}</p>
          </div>
          <div className="mapStats mapStats--inner" aria-label="区域概况">
            <MapStat value={landmarks.length} label="主题地标" />
            <MapStat value={videoCount} label="视频岛屿" />
            <MapStat value={echoTotal} label="回响连接" />
          </div>
        </header>
      </div>

      <section className="mapSceneSection" aria-label={`${category.name}区域地图`}>
        <div className="mapSceneSection__caption">
          <span>REGION / {category.id.toUpperCase()}</span>
          <p>地貌不是分类标签，而是帮助你记住内容位置的空间线索</p>
        </div>
        <MapStage
          className={categoryId === "his" ? "mapStage--historyDiscovery" : undefined}
          storageRevision={categoryId === "his" ? "history-art-v1" : undefined}
          sceneAspectRatio={categoryId === "his" ? 1586 / 992 : undefined}
          fitMode={categoryId === "his" ? "contain" : undefined}
          fitPadding={categoryId === "his" ? { desktop: 0.96, mobile: 0.84 } : undefined}
          discoveryNamespace={`region:${categoryId}`}
          background={
            <RegionTerrain
              categoryId={categoryId}
              landmarks={landmarks.map((landmark) => ({
                item: landmark.mapItem,
                glyphKind: landmark.glyphKind,
              }))}
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
