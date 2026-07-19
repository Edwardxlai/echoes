import {
  clearCollectionSynthesis,
  getAsset,
  getCollectionRow,
  isMappedRegionCategory,
  updateAsset,
  upsertCollection,
} from "@/lib/server/store";
import {
  MISC_COLLECTION,
  reclusterMisc,
  resynthesizeCollection,
  type CategoryId,
} from "@/lib/server/pipeline";

/* 人工归属修正（解析页「移动」）。落点三种：
   { categoryId } 三大陆散篇集（交回自动聚类）/ { collectionId } tc- 主题合集 / { sea:true } 未知海域。
   mix 合集是创作者策展镜像，整组归类，不收散篇也不放走单集。
   rerun-analysis 不动 L3（固定策展坐标红线），聚类只动散篇集成员——
   人工结果因此天然不被覆盖，无需额外锁标记。 */

const editable = (collectionId: string) =>
  collectionId.startsWith("tc-") || collectionId.startsWith("misc-");

export async function POST(request: Request, ctx: RouteContext<"/api/assets/[id]/move">) {
  const { id } = await ctx.params;
  const asset = getAsset(id);
  if (!asset) return Response.json({ error: "not found" }, { status: 404 });
  if (asset.status !== "analyzed")
    return Response.json({ error: "视频还没解析完成" }, { status: 400 });
  const from = asset.collectionId ? getCollectionRow(asset.collectionId) : null;
  if (from && !editable(from.id))
    return Response.json({ error: "创作者合集整组归类，不支持单集移动" }, { status: 400 });

  let body: { categoryId?: string; collectionId?: string; sea?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "参数不合法" }, { status: 400 });
  }

  let to: { categoryId: string | null; collectionId: string | null };
  if (body.collectionId) {
    const col = getCollectionRow(body.collectionId);
    if (!col || !editable(col.id) || !isMappedRegionCategory(col.categoryId))
      return Response.json({ error: "目标合集不可用" }, { status: 400 });
    to = { categoryId: col.categoryId, collectionId: col.id };
  } else if (body.categoryId) {
    if (!isMappedRegionCategory(body.categoryId))
      return Response.json({ error: "目标大陆不存在" }, { status: 400 });
    const misc = MISC_COLLECTION[body.categoryId as CategoryId];
    upsertCollection(misc.id, misc.name, body.categoryId);
    to = { categoryId: body.categoryId, collectionId: misc.id };
  } else if (body.sea) {
    to = { categoryId: null, collectionId: null };
  } else {
    return Response.json({ error: "缺少移动目标" }, { status: 400 });
  }

  if (to.collectionId === asset.collectionId && to.categoryId === asset.bigCategoryId)
    return Response.json({ ok: true, moved: false });

  updateAsset(id, { bigCategoryId: to.categoryId, collectionId: to.collectionId });

  // L6 刷新走后台，不阻塞响应。减员合集刷新失败必须清陈旧合成（旧合成引用
  // 已搬走的视频，宁缺毋滥）；增员失败保旧——同 reclusterMisc 的既有约定。
  void (async () => {
    if (from && isMappedRegionCategory(from.categoryId)) {
      try {
        await resynthesizeCollection(from.id);
      } catch {
        clearCollectionSynthesis(from.id);
      }
    }
    if (!to.collectionId) return;
    if (to.collectionId.startsWith("misc-")) {
      try {
        await reclusterMisc(to.categoryId as CategoryId);
      } catch {
        /* 聚类失败留散篇集，下次解析再聚 */
      }
    } else {
      try {
        await resynthesizeCollection(to.collectionId);
      } catch {
        /* 增员失败保旧合成 */
      }
    }
  })();

  return Response.json({
    ok: true,
    moved: true,
    categoryId: to.categoryId,
    collectionId: to.collectionId,
  });
}
