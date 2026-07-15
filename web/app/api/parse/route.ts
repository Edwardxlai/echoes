import { after } from "next/server";
import { intakeInput, runAssetPipeline, runGroupPipelines } from "@/lib/server/pipeline";

/* 统一输入口（PRD §6.4.1）：单视频 / 现成合集 / 多条独立链接。
   识别与建资产同步完成（合集枚举可能要十几秒）；
   下载/转写/AI 在响应返回后跑（after），前端拿 assetId/groupId 去等待页轮询。 */
export async function POST(request: Request) {
  let input = "";
  let expandMix = false;
  try {
    const body = await request.json();
    input = String(body?.input ?? "");
    expandMix = !!body?.expandMix; // 单集链接反查所属合集，命中按合集整组解析
  } catch {}

  try {
    const intake = await intakeInput(input, { expandMix });
    if (intake.kind === "single") {
      const assetId = intake.asset.id;
      after(() => runAssetPipeline(assetId));
      return Response.json({ kind: "single", assetId });
    }
    const ids = intake.assets.map((a) => a.id);
    const kind = intake.kind;
    after(() => runGroupPipelines(ids, kind));
    return Response.json({
      kind: intake.kind,
      groupId: intake.groupId,
      assetIds: ids,
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
