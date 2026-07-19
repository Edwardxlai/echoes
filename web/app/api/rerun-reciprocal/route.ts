import { getAnalysis, getAsset, listRecallSources } from "@/lib/server/store";
import { addReciprocalEchoes } from "@/lib/server/pipeline";

/* 开发用：给存量回响补反向记录——被回响到的旧视频节点也挂上指回新视频的回响，
   两边互见。已有回响的节点不覆盖，重复跑幂等。?asset=<id> 只处理该资产发出的回响。
   注意：/api/rerun-echoes 会整体覆盖某资产的 echoes（含反向），重跑正向后需再跑本路由。 */
export async function POST(request: Request) {
  const only = new URL(request.url).searchParams.get("asset");
  const all = listRecallSources("").filter((s) => !only || s.assetId === only);
  const results: { assetId: string; title: string; added: number }[] = [];
  for (const src of all) {
    const analysis = getAnalysis(src.assetId);
    const asset = getAsset(src.assetId);
    if (!analysis?.echoes?.length || !asset) continue;
    const added = await addReciprocalEchoes(src.assetId, analysis.echoes);
    if (added) results.push({ assetId: src.assetId, title: asset.title.slice(0, 20), added });
  }
  return Response.json({
    scanned: all.length,
    added: results.reduce((s, r) => s + r.added, 0),
    results,
  });
}
