import { detectAwemeId, lookupMixOfVideo } from "@/lib/server/pipeline";
import { listCollections, listAssetsByCollection, setCollectionSourceUrl } from "@/lib/server/store";

/* 存量回填 mix 合集的原合集链接（新解析在 intake 时已自动落）。
   只处理 mix 合集（id == groupId）：取组内第一条视频反查所属合集拿 mixId。
   tc-/misc- 是自动聚类合集，没有"原合集"，跳过。 */
export async function POST() {
  const results: { id: string; name: string; sourceUrl?: string; skipped?: string }[] = [];
  for (const row of listCollections()) {
    if (row.id.startsWith("tc-") || row.id.startsWith("misc-")) continue;
    if (row.sourceUrl) { results.push({ id: row.id, name: row.name, skipped: "已有链接" }); continue; }
    const first = listAssetsByCollection(row.id).find((a) => a.groupId === row.id);
    const awemeId = first ? detectAwemeId(first.sourceUrl) : null;
    if (!awemeId) { results.push({ id: row.id, name: row.name, skipped: "非 mix 合集" }); continue; }
    const mix = await lookupMixOfVideo(awemeId);
    if (!mix) { results.push({ id: row.id, name: row.name, skipped: "反查不到合集" }); continue; }
    const sourceUrl = `https://www.douyin.com/collection/${mix.mixId}`;
    setCollectionSourceUrl(row.id, sourceUrl);
    results.push({ id: row.id, name: row.name, sourceUrl });
  }
  return Response.json({ results });
}
