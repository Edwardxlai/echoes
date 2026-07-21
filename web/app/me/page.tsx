"use client";

import { createMapItem } from "@/lib/map-config";
import { useJournalCounts } from "@/lib/client/journal";
import { MapStage, type HotspotDef } from "@/components/map/MapStage";
import { ArchipelagoTerrain } from "@/components/map/ArchipelagoTerrain";
import { MapAtlasNav } from "@/components/map/MapChrome";
import RegionWaterCanvas from "@/components/map/RegionWaterCanvas";

// ArchipelagoTerrain 的 SVG viewBox（1000×560），排版语言与其它群岛页一致。
const ARCHIPELAGO_ASPECT_RATIO = 1000 / 560;

/* 岛屿贴图以底部为锚点向上生长，全站群岛页点击聚焦时都是"锚点到画面中心、图案略偏上"——
   多岛画面内容满，这个偏移不显眼；这里只有两座岛、背景是大片空海，偏移会很扎眼。
   只在这一页把聚焦目标点往上提一截，让图案的视觉中心而非贴图锚点落在画面中心，
   不碰 MapStage 的共享聚焦逻辑，其它群岛页不受影响。 */
const FOCUS_Y_LIFT = 14.5;

const MY_ISLANDS = [
  createMapItem({
    id: "my-thoughts",
    entityType: "video",
    entityId: "my-thoughts",
    x: 37,
    y: 58,
    asset: "/map-runtime/personal/thought-island.png",
    route: "/me/thoughts",
  }),
  createMapItem({
    id: "my-footprints",
    entityType: "video",
    entityId: "my-footprints",
    x: 65,
    y: 67,
    asset: "/map-runtime/personal/footprint-island.png",
    route: "/me/footprints",
  }),
];

/* 我的岛屿：一片私人海域，两座部件库生成的岛（docs/我的岛屿_功能设计.md §5）。
   渲染方式与其它群岛页（含未知海域）同一套 MapStage/ArchipelagoTerrain，
   不再用静态贴图拼版——只是这里的"视频岛屿"永远只有想法岛+足迹岛两座固定条目。 */
export default function MyIslandPage() {
  const counts = useJournalCounts();

  const items: HotspotDef[] = [
    {
      id: MY_ISLANDS[0].id,
      x: MY_ISLANDS[0].x,
      y: MY_ISLANDS[0].y,
      title: "想法岛",
      meta: `${counts.thoughts} 条想法留下过`,
      desc: "平铺你留下的每一条想法，点开能跳回原文。",
      route: MY_ISLANDS[0].route,
      routeLabel: "进入想法岛",
      eyebrow: "私人岛屿",
      hitArea: MY_ISLANDS[0].hitArea,
      hitBox: MY_ISLANDS[0].hitBox,
      focusX: MY_ISLANDS[0].cameraTarget.target[0],
      focusY: MY_ISLANDS[0].cameraTarget.target[1] - FOCUS_Y_LIFT,
      focusZoom: MY_ISLANDS[0].cameraTarget.zoom,
      accessibleLabel: `想法岛，${counts.thoughts} 条想法留下过`,
    },
    {
      id: MY_ISLANDS[1].id,
      x: MY_ISLANDS[1].x,
      y: MY_ISLANDS[1].y,
      title: "足迹岛",
      meta: `${counts.islands} 座岛屿探索过`,
      desc: "最近走过的岛屿轨迹，标记看过和留下过想法的地方。",
      route: MY_ISLANDS[1].route,
      routeLabel: "进入足迹岛",
      eyebrow: "私人岛屿",
      hitArea: MY_ISLANDS[1].hitArea,
      hitBox: MY_ISLANDS[1].hitBox,
      focusX: MY_ISLANDS[1].cameraTarget.target[0],
      focusY: MY_ISLANDS[1].cameraTarget.target[1] - FOCUS_Y_LIFT,
      focusZoom: MY_ISLANDS[1].cameraTarget.zoom,
      accessibleLabel: `足迹岛，${counts.islands} 座岛屿探索过`,
    },
  ];

  return (
    <main className="mapPage mapPage--archipelago mapPage--regionAtlas">
      <div className="mapPage__grain" aria-hidden="true" />
      <h1 className="srOnly">我的岛屿群岛</h1>

      <MapAtlasNav href="/" label="世界地图" />

      <section className="mapSceneSection mapSceneSection--regionAtlas" aria-label="我的岛屿群岛地图">
        <MapStage
          className="mapStage--regionAtlas mapStage--archipelago"
          sceneAspectRatio={ARCHIPELAGO_ASPECT_RATIO}
          fitMode="contain"
          fitPadding={{ desktop: 1, mobile: 0.86 }}
          resetViewOnPanelClose
          lockVisualOnSelection
          background={
            <ArchipelagoTerrain
              collectionId="my-island"
              categoryId="personal"
              islands={MY_ISLANDS.map((item) => ({ item, echo: false, viewed: true }))}
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

      <div
        className="regionAtlasLocator"
        aria-label={`我的岛屿群岛，共 2 座岛屿，${counts.islands} 座探索过，${counts.thoughts} 条想法留下过`}
      >
        <span>ARCHIPELAGO · 2 ISLANDS</span>
        <strong>我的岛屿</strong>
        <i aria-hidden="true" />
      </div>
    </main>
  );
}
