import { getAnalysis, getAsset, listRecallSources, saveExpansion } from "@/lib/server/store";
import { generateExpansion, type AnalysisResult } from "@/lib/server/pipeline";

/* 开发用：只重跑 L4 认知拓展的「补缺（gap/fill）+ 延伸」，从已存的脉络分析生成，
   不碰 backbone / 回响 / 已有——避免 L1 重跑带来的类型漂移（rerun-analysis 才动 backbone）。
   已有（gapFill.known）沿用旧值，只刷新补缺与延伸。
   ?asset=<id> 只跑单个；默认全量。逐条串行。 */
export async function POST(request: Request) {
  const only = new URL(request.url).searchParams.get("asset");
  const results: {
    assetId: string; title: string;
    gap?: boolean; extend?: number; error?: string;
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
    // 已有沿用旧值：补缺不读 known（内生），但 saveExpansion 会整块覆盖，得把 known 带回去
    const known = analysis.cognitiveExpansion?.gapFill.known ?? [];

    try {
      const exp = await generateExpansion(
        a,
        known.map(({ point, fromTitle }) => ({ point, fromTitle })),
      );
      saveExpansion(src.assetId, {
        gapFill: { known, ...(exp.gap ? { gap: exp.gap, fill: exp.fill } : {}) },
        extend: exp.extend.map((x) => ({ ...x, voices: 0 })),
      });
      results.push({ assetId: src.assetId, title, gap: Boolean(exp.gap), extend: exp.extend.length });
    } catch (e) {
      results.push({ assetId: src.assetId, title, error: (e as Error).message });
    }
  }

  return Response.json({
    total: results.length,
    gapFilled: results.filter((r) => r.gap).length,
    gated: results.filter((r) => r.gap === false).length,
    failed: results.filter((r) => r.error).length,
    results,
  });
}
