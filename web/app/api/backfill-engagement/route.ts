import { refreshAssetEngagement } from "@/lib/server/engagement";
import { listAssets } from "@/lib/server/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const force = new URL(request.url).searchParams.get("force") === "1";
  const assets = listAssets().filter(
    (asset) =>
      force ||
      !asset.metricsSource ||
      asset.likeCount == null ||
      asset.collectCount == null ||
      asset.commentCount == null,
  );
  const results: { id: string; source: "real" | "mock"; heat: number }[] = [];
  let next = 0;
  const worker = async () => {
    for (let index = next++; index < assets.length; index = next++) {
      const asset = assets[index];
      const metrics = await refreshAssetEngagement(asset.id);
      results.push({
        id: asset.id,
        source: metrics.metricsSource,
        heat: metrics.commentCount,
      });
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, assets.length) }, () => worker()));
  return Response.json({
    processed: results.length,
    real: results.filter((item) => item.source === "real").length,
    mock: results.filter((item) => item.source === "mock").length,
    results,
  });
}
