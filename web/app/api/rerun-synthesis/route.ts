import {
  listCollections, listAssetsByCollection, getAnalysis, saveSynthesis,
} from "@/lib/server/store";
import {
  generateSynthesis, runCollectionGapFill, runCollectionExtend,
  type SynthesisInputVideo, type AnalysisResult,
} from "@/lib/server/pipeline";

/* 开发用：从已存的各集脉络分析回填 L6 合集级跨视频合成，不碰单集数据。
   存量合集（管线加 L6 之前解析的）没有 synthesis，跑一次这个补上。
   ?collection=<id> 只跑单个；默认全量。<2 集的合集跳过（无从合成）。逐条串行。 */
export async function POST(request: Request) {
  const only = new URL(request.url).searchParams.get("collection");
  const results: {
    collectionId: string; name: string;
    points?: number; skipped?: string; error?: string;
  }[] = [];

  for (const col of listCollections()) {
    if (only && col.id !== only) continue;

    const videos: SynthesisInputVideo[] = [];
    for (const asset of listAssetsByCollection(col.id)) {
      const an = getAnalysis(asset.id);
      if (!an) continue;
      const analysis: AnalysisResult = {
        core_question: an.coreQuestion,
        video_type: an.videoType as AnalysisResult["video_type"],
        type_confidence: an.typeConfidence,
        summary: an.summary,
        backbone: an.backbone,
        takeaways: an.takeaways,
      };
      videos.push({ id: asset.id, title: asset.title || "未命名视频", analysis });
    }

    if (videos.length < 2) {
      results.push({ collectionId: col.id, name: col.name, skipped: `仅 ${videos.length} 集` });
      continue;
    }

    try {
      const synthesis = await generateSynthesis(videos);
      saveSynthesis(col.id, synthesis);
      // 合集补缺/延伸各自独立分层：失败不影响已存的合成结果
      try { await runCollectionGapFill(col.id, videos, synthesis.seriesQuestion); }
      catch { /* 无合集补缺 */ }
      try { await runCollectionExtend(col.id, videos, synthesis.seriesQuestion); }
      catch { /* 无合集延伸 */ }
      results.push({ collectionId: col.id, name: col.name, points: synthesis.points.length });
    } catch (e) {
      results.push({ collectionId: col.id, name: col.name, error: (e as Error).message });
    }
  }

  return Response.json({
    total: results.length,
    filled: results.filter((r) => r.points).length,
    skipped: results.filter((r) => r.skipped).length,
    failed: results.filter((r) => r.error).length,
    results,
  });
}
