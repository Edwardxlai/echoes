// 清洗存量数据里的抖音简介式标题与 #话题 标签；幂等，可重复跑。
// 用法：node scripts/clean_titles.mjs（在仓库根目录跑）
import { DatabaseSync } from "node:sqlite";
import { cleanVideoTitle } from "../web/lib/server/title-utils.mjs";

const DB = "web/data/echoes.db";
const clean = cleanVideoTitle;

const db = new DatabaseSync(DB);

let n = 0;
for (const row of db.prepare(`SELECT id, title FROM source_assets`).all()) {
  const cleaned = clean(row.title);
  if (cleaned !== row.title) {
    db.prepare(`UPDATE source_assets SET title=? WHERE id=?`).run(cleaned, row.id);
    n++;
  }
}
console.log(`source_assets 标题清洗 ${n} 条`);

n = 0;
for (const row of db.prepare(`SELECT assetId, echoes, cognitiveExpansion FROM analyses`).all()) {
  let dirty = false;

  let echoes = row.echoes;
  try {
    const arr = JSON.parse(row.echoes || "[]");
    for (const e of arr) {
      const cleaned = clean(e.targetTitle);
      if (cleaned !== e.targetTitle) { e.targetTitle = cleaned; dirty = true; }
    }
    if (dirty) echoes = JSON.stringify(arr);
  } catch { /* 坏 JSON 不动 */ }

  let expansion = row.cognitiveExpansion;
  let expDirty = false;
  try {
    const exp = JSON.parse(row.cognitiveExpansion || "null");
    for (const k of exp?.gapFill?.known ?? []) {
      const cleaned = clean(k.fromTitle);
      if (k.fromTitle && cleaned !== k.fromTitle) { k.fromTitle = cleaned; expDirty = true; }
    }
    if (expDirty) expansion = JSON.stringify(exp);
  } catch { /* 坏 JSON 不动 */ }

  if (dirty || expDirty) {
    db.prepare(`UPDATE analyses SET echoes=?, cognitiveExpansion=? WHERE assetId=?`).run(echoes, expansion, row.assetId);
    n++;
  }
}
console.log(`analyses 回响/known 清洗 ${n} 条`);

n = 0;
for (const row of db.prepare(`SELECT id, name FROM collections`).all()) {
  const cleaned = clean(row.name);
  if (cleaned !== row.name) {
    db.prepare(`UPDATE collections SET name=? WHERE id=?`).run(cleaned, row.id);
    n++;
  }
}
console.log(`collections 合集名清洗 ${n} 条`);
console.log("清洗结束");
