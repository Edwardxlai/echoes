// 把测试集 CSV（docs/测试集_7_13 - Sheet1.csv）逐条灌进 /api/parse，串行等每条完成。
// 用法：node scripts/ingest_testset.mjs [csv路径] [只跑的样本标号,逗号分隔]
// 结果：logs/ingest_testset.log（过程）+ logs/ingest_testset_results.json（汇总）
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";

const BASE = process.env.ECHOES_BASE || "http://localhost:3100";
const CSV = process.argv[2] || "docs/测试集_7_13 - Sheet1.csv";
const only = process.argv[3] ? new Set(process.argv[3].split(",")) : null;

mkdirSync("logs", { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (s) => {
  console.log(s);
  appendFileSync("logs/ingest_testset.log", `${new Date().toISOString()} ${s}\n`);
};

const rows = [];
for (const line of readFileSync(CSV, "utf8").split(/\r?\n/).slice(1)) {
  const cols = line.split(",");
  const id = cols[0]?.trim();
  if (!/^\d+$/.test(id)) continue;
  const m = line.match(/https?:\/\/v\.douyin\.com\/[A-Za-z0-9_-]+\/?/);
  rows.push({ id, kind: cols[1], cat: cols[2], topic: cols[4], url: m?.[0] ?? null });
}
log(`共 ${rows.length} 行样本${only ? `，本次只跑：${[...only].join(",")}` : ""}`);

async function pollAsset(assetId, timeoutMs = 20 * 60 * 1000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(`${BASE}/api/assets/${assetId}`);
      if (res.ok) {
        const a = await res.json();
        if (a.status === "analyzed" || a.status === "failed") return a;
      }
    } catch { /* 网络抖动，继续轮询 */ }
    if (Date.now() - start > timeoutMs) return { status: "timeout", title: "", errorMessage: "轮询超时" };
    await sleep(5000);
  }
}

const results = [];
for (const row of rows) {
  if (only && !only.has(row.id)) continue;
  if (!row.url) {
    log(`#${row.id} SKIP：无 URL（抖音口令需 App，解析不了）`);
    results.push({ ...row, outcome: "skip_no_url" });
    continue;
  }
  log(`#${row.id} [${row.kind}/${row.cat}] ${row.topic} → ${row.url}`);

  let resp;
  try {
    const res = await fetch(`${BASE}/api/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // CSV 标注为"合集"的样本，其链接多是合集中某一集的分享链接：反查所属合集整组解析
      body: JSON.stringify({ input: row.url, expandMix: row.kind === "合集" }),
    });
    resp = await res.json();
    if (!res.ok) throw new Error(resp?.error || `HTTP ${res.status}`);
  } catch (e) {
    log(`  intake 失败：${e.message}`);
    results.push({ ...row, outcome: "intake_failed", error: e.message });
    writeFileSync("logs/ingest_testset_results.json", JSON.stringify(results, null, 2));
    continue;
  }

  const ids = resp.kind === "single" ? [resp.assetId] : resp.assetIds;
  log(`  kind=${resp.kind}，${ids.length} 条资产`);
  const assets = [];
  for (const assetId of ids) {
    const a = await pollAsset(assetId);
    log(`  ${assetId} → ${a.status}${a.status === "failed" ? `：${a.errorMessage}` : ""}｜${(a.title || "").slice(0, 40)}`);
    assets.push({ assetId, status: a.status, title: a.title, error: a.errorMessage });
  }
  if (resp.kind !== "single") await sleep(10000); // 等组收尾（合集命名+归组）

  results.push({ ...row, outcome: "done", kind: resp.kind, groupId: resp.groupId, assets });
  writeFileSync("logs/ingest_testset_results.json", JSON.stringify(results, null, 2));
}
log(`全部结束：${results.length} 行已处理`);
