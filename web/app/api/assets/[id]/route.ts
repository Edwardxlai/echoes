import { getAsset } from "@/lib/server/store";

/* 解析等待页轮询的状态源。 */
export async function GET(_req: Request, ctx: RouteContext<"/api/assets/[id]">) {
  const { id } = await ctx.params;
  const asset = getAsset(id);
  if (!asset) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({
    id: asset.id,
    status: asset.status,
    step: asset.step,
    title: asset.title,
    author: asset.author,
    errorMessage: asset.errorMessage,
  });
}
