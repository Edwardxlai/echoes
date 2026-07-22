import { after } from "next/server";
import { intakeInput, runAssetPipeline, runGroupPipelines } from "@/lib/server/pipeline";

/* 统一输入口（PRD §6.4.1）：单视频 / 现成合集 / 多条独立链接。
   识别与建资产同步完成（合集枚举可能要十几秒）；
   下载/转写/AI 在响应返回后跑（after），前端拿 assetId/groupId 去等待页轮询。 */
export async function POST(request: Request) {
  let input = "";
  let expandMix = false;
  let forceSingle = false;
  let dedupe = true;
  let overwrite = false;
  try {
    const body = await request.json();
    input = String(body?.input ?? "");
    expandMix = !!body?.expandMix;     // 单集链接反查所属合集，命中按合集整组解析
    forceSingle = !!body?.forceSingle; // 用户已选「只解析这条」，跳过合集反查
    dedupe = body?.dedupe !== false;
    overwrite = !!body?.overwrite;
  } catch {}

  try {
    const intake = await intakeInput(input, { expandMix, forceSingle, dedupe, overwrite });
    if (intake.kind === "confirm-mix") {
      // 反查到这条属于某合集：回给前端问用户；「解析整个合集」按钮直接提交这个合集链接
      return Response.json({
        kind: "confirm-mix",
        mixName: intake.mixName,
        mixUrl: `https://www.douyin.com/collection/${intake.mixId}`,
      });
    }
    if (intake.kind === "confirm-duplicate") {
      return Response.json(intake);
    }
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
