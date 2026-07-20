import { searchAnalyzedAssets } from "@/lib/server/store";

/* 首页搜索（解析条右侧切换钮）：在已解析资产里按
   标题/作者/核心问题/合集名 LIKE 匹配，前端 200ms 防抖调用。 */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (!q) return Response.json({ hits: [] });
  return Response.json({ hits: searchAnalyzedAssets(q) });
}
