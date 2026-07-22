import {
  getAnalysis, getAsset, getTranscript, listRecallSources, saveDispatch,
} from "@/lib/server/store";
import { classifyTemplate, VIDEO_TYPES, type AnalysisResult } from "@/lib/server/pipeline";

/* 开发用：知音_重构执行计划 Phase 1b——存量真实视频回填模板派发（template/renderData）。
   与 rerun-analysis 不同：不重跑脉络分析，只在既有 backbone 之上另判"用哪张图渲染"。
   ?asset=<id> 只跑单个；?all=1 全量；不传 all 时只跑当前 template=argument 的存量（增量补跑）。
   ?dryRun=1 只判定不落库，用于先看分布/抽查幻觉再决定要不要写。逐条串行，同 rerun-analysis 限流理由。 */
export async function POST(request: Request) {
  const q = new URL(request.url).searchParams;
  const only = q.get("asset");
  const all = q.get("all") === "1";
  const dryRun = q.get("dryRun") === "1";
  const results: {
    assetId: string; title: string;
    from: string; to?: string; confidence?: number; reason?: string; fields?: number; error?: string;
  }[] = [];

  for (const src of listRecallSources("")) {
    if (only && src.assetId !== only) continue;
    const analysis = getAnalysis(src.assetId);
    const asset = getAsset(src.assetId);
    if (!analysis || !asset) continue;
    if (!VIDEO_TYPES.has(analysis.videoType)) {
      results.push({
        assetId: src.assetId,
        title: asset.title.slice(0, 24),
        from: analysis.videoType,
        error: "旧骨架类型，请先调用 rerun-analysis 重新判定结构",
      });
      continue;
    }
    if (!only && !all && analysis.dispatch?.template !== "argument") continue;
    const title = asset.title.slice(0, 24);
    const from = analysis.dispatch?.template ?? "argument";
    const transcript = getTranscript(src.assetId);
    if (!transcript) {
      results.push({ assetId: src.assetId, title, from, error: "无转写" });
      continue;
    }
    try {
      const a: AnalysisResult = {
        core_question: analysis.coreQuestion,
        video_type: analysis.videoType as AnalysisResult["video_type"],
        type_confidence: analysis.typeConfidence,
        summary: analysis.summary,
        backbone: analysis.backbone,
        takeaways: analysis.takeaways,
      };
      const dispatch = await classifyTemplate(a, analysis.echoes ?? [], transcript, asset.title);
      const fields =
        "events" in dispatch.renderData ? dispatch.renderData.events.length
        : "rows" in dispatch.renderData ? dispatch.renderData.rows.length
        : "bars" in dispatch.renderData ? dispatch.renderData.bars.length
        : "on" in dispatch.renderData ? dispatch.renderData.on.length
        : dispatch.renderData.nodes.length;
      if (!dryRun) saveDispatch(src.assetId, dispatch);
      results.push({
        assetId: src.assetId, title, from,
        to: dispatch.template, confidence: dispatch.confidence,
        reason: dispatch.downgrade.reason, fields,
      });
    } catch (e) {
      results.push({ assetId: src.assetId, title, from, error: (e as Error).message });
    }
  }

  const byTemplate: Record<string, number> = {};
  for (const r of results) if (r.to) byTemplate[r.to] = (byTemplate[r.to] || 0) + 1;

  return Response.json({ total: results.length, dryRun, byTemplate, results });
}
