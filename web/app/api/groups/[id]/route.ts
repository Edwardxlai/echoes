import { getAssetsByGroup } from "@/lib/server/store";

/* 合集/多链接分组的整体进度（等待页轮询）。 */
export async function GET(_req: Request, ctx: RouteContext<"/api/groups/[id]">) {
  const { id } = await ctx.params;
  const assets = getAssetsByGroup(id);
  if (!assets.length) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({
    groupId: id,
    assets: assets.map((a) => ({
      id: a.id,
      status: a.status,
      step: a.step,
      title: a.title,
      errorMessage: a.errorMessage,
    })),
  });
}
