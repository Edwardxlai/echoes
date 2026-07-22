import { getAnalysis, getAsset, listRecallSources, saveCommentHeat } from "@/lib/server/store";
import { generateCommentHeat, type AnalysisResult } from "@/lib/server/pipeline";

/* 开发用：只重跑 L4b 评论热度（mock），从已存的脉络分析生成，
   不碰 backbone / 回响 / 补缺。?asset=<id> 只跑单个；默认全量。逐条串行。 */
export async function POST(request: Request) {
  const only = new URL(request.url).searchParams.get("asset");
  const results: {
    assetId: string; title: string;
    topics?: number; error?: string;
  }[] = [];

  for (const src of listRecallSources("")) {
    if (only && src.assetId !== only) continue;
    const analysis = getAnalysis(src.assetId);
    const asset = getAsset(src.assetId);
    if (!analysis || !asset) continue;
    const title = asset.title.slice(0, 20);

    const a: AnalysisResult = {
      core_question: analysis.coreQuestion,
      video_type: analysis.videoType as AnalysisResult["video_type"],
      type_confidence: analysis.typeConfidence,
      summary: analysis.summary,
      backbone: analysis.backbone,
      takeaways: analysis.takeaways,
    };
    try {
      const heat = await generateCommentHeat(a, title);
      saveCommentHeat(src.assetId, heat);
      results.push({ assetId: src.assetId, title, topics: heat.topics.length });
    } catch (e) {
      results.push({ assetId: src.assetId, title, error: (e as Error).message });
    }
  }

  return Response.json({
    total: results.length,
    filled: results.filter((r) => r.topics).length,
    failed: results.filter((r) => r.error).length,
    results,
  });
}
