import {
  getAnalysis, getAsset, getTranscript, listRecallSources,
  saveAnalysis, saveEchoes, saveExpansion, saveCommentHeat,
} from "@/lib/server/store";
import {
  analyzeTranscript, classifyTemplate, generateLinks, generateExpansion, VIDEO_TYPES,
  type AnalysisResult,
} from "@/lib/server/pipeline";

/* 开发用：对已解析视频重跑 L1 脉络分析（PRD 变更摘要 #15：五类骨架，新增叙事类）。
   backbone 换血后回响锚点与补缺全部失效，故 L5/L4 连带重跑；
   L3 大类归属不动——固定策展坐标红线，重跑不得让内容在地图上跳变。
   类型同理默认锁定：沿用已定 videoType，重跑只换骨架血不换类型（类型漂移遗留的修复）；
   ?retype=1 才重新判型（#15 那类骨架体系升级的迁移场景用）。
   默认只重跑当前 videoType=intro 的存量（#15 要求至少覆盖原介绍类）；
   ?all=1 全量；?asset=<id> 只跑单个。逐条串行（sidecar 限流同 rerun-echoes）。 */
export async function POST(request: Request) {
  const q = new URL(request.url).searchParams;
  const only = q.get("asset");
  const all = q.get("all") === "1";
  const retype = q.get("retype") === "1";
  const results: {
    assetId: string; title: string;
    from?: string; to?: string; nodes?: number; echoes?: number; error?: string;
  }[] = [];

  for (const src of listRecallSources("")) {
    if (only && src.assetId !== only) continue;
    const analysis = getAnalysis(src.assetId);
    const asset = getAsset(src.assetId);
    if (!analysis || !asset) continue;
    // 默认只迁移旧的体裁分类；已是五种渲染结构的存量不重复消耗。
    if (!only && !all && VIDEO_TYPES.has(analysis.videoType)) continue;
    const title = asset.title.slice(0, 20);
    const transcript = getTranscript(src.assetId);
    if (!transcript) {
      results.push({ assetId: src.assetId, title, error: "无转写" });
      continue;
    }
    const lockType = !retype && VIDEO_TYPES.has(analysis.videoType)
      ? (analysis.videoType as AnalysisResult["video_type"])
      : undefined;
    try {
      const a = await analyzeTranscript(transcript, lockType ? { lockType } : undefined);
      // 回响先行：五模板要把 echo 织进 renderData，必须在 classifyTemplate 之前生成回响。
      let echoes: Awaited<ReturnType<typeof generateLinks>>["echoes"] = [];
      try {
        echoes = (await generateLinks(a, asset.title, listRecallSources(src.assetId))).echoes;
      } catch { /* 没有回响，脉络照常可用 */ }
      const echoCount = echoes.length;
      const dispatch = await classifyTemplate(a, echoes, transcript, asset.title);
      // saveAnalysis 的 REPLACE 会顺带清空旧 cognitiveExpansion/echoes 列——它们挂在旧 backbone 上，本就该作废
      saveAnalysis({
        assetId: src.assetId,
        coreQuestion: a.core_question,
        videoType: a.video_type,
        // 锁定重跑时保留原判定置信度——本次没有重新判型，模型给的置信度没有意义
        typeConfidence: lockType ? analysis.typeConfidence : a.type_confidence,
        summary: a.summary,
        backbone: a.backbone,
        takeaways: a.takeaways,
        dispatch,
      });
      // 热度图是视频级评论主题，不挂在 backbone 节点上；
      // 骨架重跑时保留，避免 INSERT OR REPLACE 将它误清空。
      if (analysis.commentHeat) saveCommentHeat(src.assetId, analysis.commentHeat);
      // saveAnalysis 清了 echoes 列，紧随其后写回。
      if (echoes.length) saveEchoes(src.assetId, echoes);
      try {
        const exp = await generateExpansion(a);
        saveExpansion(src.assetId, {
          gapFill: exp.gap
            ? { gap: exp.gap, fill: exp.fill, ...(exp.searchTerms.length ? { searchTerms: exp.searchTerms } : {}) }
            : {},
        });
      } catch { /* 脉络照常可用 */ }

      results.push({
        assetId: src.assetId, title,
        from: analysis.videoType, to: a.video_type, nodes: a.backbone.length, echoes: echoCount,
      });
    } catch (e) {
      results.push({ assetId: src.assetId, title, error: (e as Error).message });
    }
  }

  return Response.json({
    total: results.length,
    retyped: results.filter((r) => r.to && r.to !== r.from).length,
    results,
  });
}
