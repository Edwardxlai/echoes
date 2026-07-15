// 给缺封面的已解析资产补抓封面：重新走 sidecar 拿 cover_url → 下载到 web/public/covers/real/。
// 用法：node scripts/backfill_covers.mjs（在仓库根目录跑，dev 服务器可以在跑但别并发写库高峰时用）
import { DatabaseSync } from "node:sqlite";
import { writeFileSync, mkdirSync } from "node:fs";

const DB = "web/data/echoes.db";
const SIDECAR = process.env.PARSE_VIDEO_API_URL || "http://localhost:8080";
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const db = new DatabaseSync(DB);
const rows = db
  .prepare(`SELECT id, sourceUrl, title FROM source_assets WHERE status='analyzed' AND cover=''`)
  .all();
console.log(`${rows.length} 条缺封面`);
mkdirSync("web/public/covers/real", { recursive: true });

for (const row of rows) {
  try {
    const res = await fetch(
      `${SIDECAR}/video/share/url/parse?url=${encodeURIComponent(row.sourceUrl)}`,
      { signal: AbortSignal.timeout(20000) }
    );
    const body = await res.json();
    const coverUrl = body?.data?.cover_url;
    if (!coverUrl) throw new Error("无 cover_url");
    const img = await fetch(coverUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
    if (!img.ok) throw new Error(`封面 ${img.status}`);
    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.length < 1024) throw new Error("文件太小");
    writeFileSync(`web/public/covers/real/${row.id}.jpg`, buf);
    db.prepare(`UPDATE source_assets SET cover=? WHERE id=?`).run(`/covers/real/${row.id}.jpg`, row.id);
    console.log(`OK ${row.id} ${row.title.slice(0, 24)}`);
  } catch (e) {
    console.log(`FAIL ${row.id} ${row.title.slice(0, 24)}：${e.message}`);
  }
  await sleep(1500); // sidecar 限流
}
console.log("补抓结束");
