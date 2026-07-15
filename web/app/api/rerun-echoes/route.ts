import { getAnalysis, getAsset, listRecallSources, saveEchoes } from "@/lib/server/store";
import { generateLinks, type AnalysisResult } from "@/lib/server/pipeline";

/* 开发用：对已解析视频重跑 L5 回响匹配——提示词/展示结构升级后刷新存量。
   逐条串行调 LLM，空结果也覆盖（清掉旧格式）。known/认知拓展不动。
   ?asset=<id> 只补跑单个资产。 */
export async function POST(request: Request) {
  const only = new URL(request.url).searchParams.get("asset");
  const all = listRecallSources("").filter((s) => !only || s.assetId === only);
  const results: { assetId: string; title: string; echoes?: number; error?: string }[] = [];
  for (const src of all) {
    const analysis = getAnalysis(src.assetId);
    const asset = getAsset(src.assetId);
    if (!analysis || !asset) continue;
    try {
      const a: AnalysisResult = {
        core_question: analysis.coreQuestion,
        video_type: (analysis.videoType || "argument") as AnalysisResult["video_type"],
        type_confidence: analysis.typeConfidence,
        summary: analysis.summary,
        backbone: analysis.backbone,
        takeaways: analysis.takeaways,
      };
      const links = await generateLinks(a, asset.title, listRecallSources(src.assetId));
      saveEchoes(src.assetId, links.echoes);
      results.push({ assetId: src.assetId, title: asset.title.slice(0, 20), echoes: links.echoes.length });
    } catch (e) {
      results.push({ assetId: src.assetId, title: asset.title.slice(0, 20), error: (e as Error).message });
    }
  }
  return Response.json({
    total: results.length,
    echoes: results.reduce((s, r) => s + (r.echoes ?? 0), 0),
    results,
  });
}
