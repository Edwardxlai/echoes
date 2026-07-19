import {
  reclusterMisc, MISC_COLLECTION, type CategoryId, type ReclusterResult,
} from "@/lib/server/pipeline";

/* 手动触发散篇集聚类（存量回填/人工修；日常由解析批次收尾自动触发）。
   ?category=eco 只跑单类，默认五类全跑；?dryRun=1 只返回拟聚结果不落库。 */
export async function POST(request: Request) {
  const params = new URL(request.url).searchParams;
  const only = params.get("category");
  const dryRun = params.get("dryRun") === "1";
  const cats = Object.keys(MISC_COLLECTION) as CategoryId[];
  if (only && !cats.includes(only as CategoryId)) {
    return Response.json({ error: `未知大类：${only}` }, { status: 400 });
  }

  const results: (ReclusterResult | { category: string; error: string })[] = [];
  for (const cat of only ? [only as CategoryId] : cats) {
    try {
      results.push(await reclusterMisc(cat, dryRun));
    } catch (e) {
      results.push({ category: cat, error: (e as Error).message });
    }
  }
  return Response.json({ dryRun, results });
}
