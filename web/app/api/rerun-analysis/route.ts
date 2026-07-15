import {
  getAnalysis, getAsset, getTranscript, listRecallSources,
  saveAnalysis, saveEchoes, saveExpansion,
} from "@/lib/server/store";
import {
  analyzeTranscript, generateLinks, generateKnown, generateExpansion, type KnownPoint,
} from "@/lib/server/pipeline";

/* 开发用：对已解析视频重跑 L1 脉络分析（PRD 变更摘要 #15：五类骨架，新增叙事类）。
   backbone 换血后回响的 nodeIndex 与认知拓展的 known 全部失效，故 L5/L4 连带重跑；
   L3 大类归属不动——固定策展坐标红线，重跑不得让内容在地图上跳变。
   默认只重跑当前 videoType=intro 的存量（#15 要求至少覆盖原介绍类）；
   ?all=1 全量；?asset=<id> 只跑单个。逐条串行（sidecar 限流同 rerun-echoes）。 */
export async function POST(request: Request) {
  const q = new URL(request.url).searchParams;
  const only = q.get("asset");
  const all = q.get("all") === "1";
  const results: {
    assetId: string; title: string;
    from?: string; to?: string; nodes?: number; echoes?: number; error?: string;
  }[] = [];

  for (const src of listRecallSources("")) {
    if (only && src.assetId !== only) continue;
    const analysis = getAnalysis(src.assetId);
    const asset = getAsset(src.assetId);
    if (!analysis || !asset) continue;
    if (!only && !all && analysis.videoType !== "intro") continue;
    const title = asset.title.slice(0, 20);
    const transcript = getTranscript(src.assetId);
    if (!transcript) {
      results.push({ assetId: src.assetId, title, error: "无转写" });
      continue;
    }
    try {
      const a = await analyzeTranscript(transcript);
      // saveAnalysis 的 REPLACE 会顺带清空旧 cognitiveExpansion/echoes 列——它们挂在旧 backbone 上，本就该作废
      saveAnalysis({
        assetId: src.assetId,
        coreQuestion: a.core_question,
        videoType: a.video_type,
        typeConfidence: a.type_confidence,
        summary: a.summary,
        backbone: a.backbone,
        takeaways: a.takeaways,
      });

      let known: KnownPoint[] = [];
      let echoCount = 0;
      try {
        const links = await generateLinks(a, asset.title, listRecallSources(src.assetId));
        echoCount = links.echoes.length;
        saveEchoes(src.assetId, links.echoes);
      } catch { /* 没有回响，脉络照常可用 */ }
      try {
        known = await generateKnown(a, listRecallSources(src.assetId));
      } catch { /* 没有已有积累，认知拓展照常可用 */ }
      try {
        const exp = await generateExpansion(a, known.map(({ point, fromTitle }) => ({ point, fromTitle })));
        saveExpansion(src.assetId, {
          gapFill: { known, ...(exp.gap ? { gap: exp.gap, fill: exp.fill } : {}) },
          extend: exp.extend.map((x) => ({ ...x, voices: 0 })),
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
