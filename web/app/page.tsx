import { CATEGORY_LIST, COLLECTIONS } from "@/lib/data";
import { WORLD_SCENE } from "@/lib/map-config";
import type { WorldRegionId } from "@/lib/map-scene/schema";
import { hasRealMapContent, realWorldSummary } from "@/lib/server/real-data";
import { BrandHomeLink } from "@/components/brand/BrandHomeLink";
import { WorldMapStage, type WorldMapItem } from "@/components/map/WorldMapStage";
import { HeroInput } from "@/components/map/HeroInput";

export const dynamic = "force-dynamic";

export default function WorldMapPage() {
  const itemByEntity = new Map(WORLD_SCENE.items.map((item) => [item.entityId, item]));
  // 有真实解析内容时，三大类计数换成真实数据（种子数据让位，详情页仍可直链）
  const summary = hasRealMapContent() ? realWorldSummary() : null;
  const items: WorldMapItem[] = CATEGORY_LIST.flatMap((category) => {
    const mapItem = itemByEntity.get(category.id);
    if (!mapItem) return [];

    const collections = category.collectionIds.map((id) => COLLECTIONS[id]).filter(Boolean);
    const seedVideoCount = collections.reduce((sum, collection) => sum + collection.videoIds.length, 0);
    const real = summary?.[category.id];
    const collectionCount = summary ? real?.collectionCount ?? 0 : category.collectionIds.length;
    const videoCount = summary ? real?.videoCount ?? 0 : seedVideoCount;
    const echoCount = summary ? real?.echoCount ?? 0 : category.echoCount;

    return [
      {
        id: mapItem.id as WorldRegionId,
        x: mapItem.x,
        y: mapItem.y,
        title: category.name,
        meta: `${collectionCount} 个合集 · ${videoCount} 条视频${echoCount > 0 ? ` · ${echoCount} 次回响` : ""}`,
        desc: `沿着「${category.name}」区域的地标继续深入，查看已经被整理成空间记忆的合集。`,
        route: mapItem.route,
        routeLabel: `进入${category.name}区域`,
        echo: echoCount > 0,
        accessibleLabel: `${category.name}，${collectionCount} 个合集，${videoCount} 条视频，${echoCount} 次回响`,
      },
    ];
  });

  return (
    <main className="mapPage mapPage--world">
      <div className="mapPage__grain" aria-hidden="true" />
      <h1 className="srOnly">回响世界区域</h1>

      <header className="worldMasthead mapShell" aria-label="回响与内容解析">
        <BrandHomeLink className="worldMasthead__brand" />
        <div className="worldMasthead__input">
          <HeroInput compact />
        </div>
      </header>

      <section className="mapSceneSection mapSceneSection--world" aria-label="世界地图">
        <WorldMapStage items={items} />
      </section>
    </main>
  );
}
