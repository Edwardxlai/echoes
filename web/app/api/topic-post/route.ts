import { categoryGate, resolveTopic, topicQuotePool } from "@/lib/server/discussion";
import { addTopicPost, deleteTopicPost } from "@/lib/server/store";

/* 同题空间发帖（讨论区 P0，单用户本地）。
   门槛在这里收（延伸题线查大类积累；回响线自动解锁）——入口只是门，票在门口验。 */
export async function POST(request: Request) {
  const data = (await request.json().catch(() => null)) as {
    topicId?: unknown;
    body?: unknown;
    parentId?: unknown;
    quoteNodeId?: unknown;
  } | null;
  const topicId = typeof data?.topicId === "string" ? data.topicId : "";
  const body = typeof data?.body === "string" ? data.body.trim() : "";
  const parentId = typeof data?.parentId === "string" ? data.parentId : undefined;
  const quoteNodeId =
    typeof data?.quoteNodeId === "string" ? data.quoteNodeId : undefined;

  if (!topicId || !body || body.length > 1000) {
    return Response.json({ error: "想法不能为空，且不超过 1000 字" }, { status: 400 });
  }
  const topic = resolveTopic(topicId);
  if (!topic) {
    return Response.json({ error: "这条讨论不存在" }, { status: 404 });
  }
  if (topic.kind === "extend") {
    const gate = categoryGate(topic.categoryId);
    if (!gate.unlocked) {
      return Response.json(
        { error: `在${gate.categoryName}大陆看够 ${gate.need} 条才能开口` },
        { status: 403 }
      );
    }
  }
  /* quoteRef：主帖和回复都能带；nodeId 必须在本题的可引池里，快照文本取服务端原句 */
  let quote: { nodeId: string; text: string } | undefined;
  if (quoteNodeId) {
    const item = topicQuotePool(topicId).find((q) => q.nodeId === quoteNodeId);
    if (!item) {
      return Response.json({ error: "引用的原文不存在" }, { status: 400 });
    }
    quote = { nodeId: item.nodeId, text: item.text };
  }
  addTopicPost(topicId, body, parentId, quote);
  return Response.json({ ok: true });
}

/* 删自己的想法（单用户本地，无鉴权）。种子帖 id 不在库里，天然删不掉。 */
export async function DELETE(request: Request) {
  const data = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof data?.id === "string" ? data.id : "";
  if (!id) {
    return Response.json({ error: "缺少要删除的想法 id" }, { status: 400 });
  }
  deleteTopicPost(id);
  return Response.json({ ok: true });
}
