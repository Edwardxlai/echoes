import { notFound } from "next/navigation";
import { collectionsOf, getCategory } from "@/lib/data";
import { REGION_SCENES, type MapItem } from "@/lib/map-config";
import { hasRealMapContent, realCollectionsOf } from "@/lib/server/real-data";
import { MapStage, type HotspotDef } from "@/components/map/MapStage";
import { RegionTerrain } from "@/components/map/RegionTerrain";
import RegionWaterCanvas from "@/components/map/RegionWaterCanvas";
import { MapAtlasNav } from "@/components/map/MapChrome";

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
  sourceUrl?: string;
}

const REGION_NUMBER: Record<string, string> = {
  eco: "01",
  his: "02",
  tech: "03",
  soc: "04",
  sci: "05",
};
const REGION_ASPECT_RATIO: Record<string, number> = {
  eco: 1672 / 941,
  his: 1586 / 992,
  tech: 16 / 9,
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
      synthesisRoute: real.hasSynthesis ? `${real.mapItem.route}/synthesis` : undefined,
      sourceUrl: real.sourceUrl || undefined,
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

  const atlasLandmarks = landmarks;

  // 卡片挂在 labelAnchor（建筑脚底 + 手调偏移，落建筑下方空地）；镜头聚焦仍对准建筑本体
  const items: HotspotDef[] = atlasLandmarks.map((landmark) => ({
    id: landmark.mapItem.id,
    x: landmark.mapItem.labelAnchor[0],
    y: landmark.mapItem.labelAnchor[1],
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
    secondaryLabel: landmark.synthesisRoute ? "合集解析" : undefined,
    sourceHref: landmark.sourceUrl,
    sourceLabel: landmark.sourceUrl ? "查看原合集" : undefined,
    echo: landmark.echoCount > 0,
    focusX: landmark.mapItem.x,
    focusY: landmark.mapItem.y,
    focusZoom: 1.14,
    eyebrow: "主题地标",
    hitArea: landmark.mapItem.hitArea,
    hitBox: landmark.mapItem.hitBox,
  }));

  return (
    <main className={`mapPage mapPage--region mapPage--${categoryId} mapPage--regionAtlas`}>
      <div className="mapPage__grain" aria-hidden="true" />
      <h1 className="srOnly">{category.name}知识区域</h1>

      <MapAtlasNav href="/" />

      <section
        className="mapSceneSection mapSceneSection--regionAtlas"
        aria-label={`${category.name}区域地图`}
      >
        <MapStage
          className={`mapStage--regionAtlas mapStage--regionAtlas--${categoryId}${categoryId === "his" ? " mapStage--historyDiscovery" : ""}`}
          initialZoom={categoryId === "eco" || categoryId === "tech" ? 0.94 : 1}
          sceneAspectRatio={REGION_ASPECT_RATIO[categoryId] ?? 16 / 9}
          fitMode="contain"
          fitPadding={categoryId === "eco" || categoryId === "tech" ? { desktop: 0.94, mobile: 0.86 } : { desktop: 1, mobile: 0.86 }}
          resetViewOnPanelClose
          lockVisualOnSelection
          discoveryNamespace={`region:${categoryId}`}
          background={
            <RegionTerrain
              categoryId={categoryId}
              landmarks={atlasLandmarks.map((landmark) => ({
                item: landmark.mapItem,
                glyphKind: landmark.glyphKind,
              }))}
            />
          }
          stageBackground={
            categoryId === "eco" || categoryId === "his" || categoryId === "tech" ? (
              <div className="regionStageWater">
                <RegionWaterCanvas />
              </div>
            ) : undefined
          }
          items={items}
        />
      </section>

      <div className="regionAtlasLocator" aria-label={`${category.name}区域，共 ${landmarks.length} 处地标`}>
        <span>REGION {REGION_NUMBER[categoryId] ?? "00"}</span>
        <strong>{category.name}区域</strong>
        <i aria-hidden="true" />
      </div>
    </main>
  );
}
