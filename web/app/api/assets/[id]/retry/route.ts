import { after } from "next/server";
import { runAssetPipeline } from "@/lib/server/pipeline";
import { getAsset, updateAsset } from "@/lib/server/store";

/* 失败任务原地重试：重置回 uploaded 后整条管线重跑（直链/下载/转写/AI 全部重来）。
   最常见的失败是下载被网络/CDN 中途掐断，重试即愈。 */
export async function POST(_request: Request, ctx: RouteContext<"/api/assets/[id]/retry">) {
  const { id } = await ctx.params;
  const asset = getAsset(id);
  if (!asset) return Response.json({ error: "not found" }, { status: 404 });
  if (asset.status !== "failed") {
    return Response.json({ error: "只有失败的任务可以重试" }, { status: 400 });
  }
  updateAsset(id, { status: "uploaded", step: "排队重试", errorMessage: "" });
  after(() => runAssetPipeline(id));
  return Response.json({ ok: true });
}
