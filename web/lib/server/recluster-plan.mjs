/**
 * 散篇集聚类的纯规划层：把 LLM 的聚类提议核对成一份确定的执行计划。
 * 不变量（边界簇漂移的护栏）：
 * 1. 只有散篇集里的视频会被移动，一条视频一轮最多移动一次（assign 优先）；
 * 2. 新簇必须 ≥3 条有效成员，否则整簇留在散篇集；
 * 3. 新簇名与已有合集重名 → 并入该合集，不建同主题的孪生合集；
 *    同一轮里两个新簇重名 → 合并成一个。
 */

const MAX_NAME = 16;

/**
 * @param {{ assign?: { videoId?: string, collectionId?: string }[],
 *           clusters?: { name?: string, ids?: string[] | null }[] }} parsed LLM 原始输出
 * @param {string[]} miscIds 散篇集当前成员 id
 * @param {{ id: string, name: string }[]} existing 该大类已有的 tc- 合集
 * @returns {{ assigned: { videoId: string, collectionId: string }[],
 *             created: { name: string, ids: string[] }[] }}
 */
export function planRecluster(parsed, miscIds, existing) {
  const misc = new Set(miscIds);
  const existingIds = new Set(existing.map((c) => c.id));
  const idByName = new Map(existing.map((c) => [c.name.trim(), c.id]));
  const taken = new Set();
  const assigned = [];
  const created = [];
  const createdByName = new Map();

  for (const it of Array.isArray(parsed.assign) ? parsed.assign : []) {
    const vid = String(it?.videoId ?? "");
    const colId = String(it?.collectionId ?? "");
    if (!existingIds.has(colId) || !misc.has(vid) || taken.has(vid)) continue;
    taken.add(vid);
    assigned.push({ videoId: vid, collectionId: colId });
  }

  for (const cl of Array.isArray(parsed.clusters) ? parsed.clusters : []) {
    const name = String(cl?.name ?? "").trim().slice(0, MAX_NAME);
    const ids = (Array.isArray(cl?.ids) ? cl.ids : [])
      .map(String)
      .filter((id) => misc.has(id) && !taken.has(id));
    if (!name || !ids.length) continue;

    const existingId = idByName.get(name);
    if (existingId) {
      // 与已有合集同名：并入，不建孪生合集（并入无 ≥3 门槛，同 assign）
      for (const id of ids) { taken.add(id); assigned.push({ videoId: id, collectionId: existingId }); }
      continue;
    }
    const prev = createdByName.get(name);
    if (prev) {
      for (const id of ids) { taken.add(id); prev.ids.push(id); }
      continue;
    }
    if (ids.length < 3) continue; // 不够成簇，整簇留散篇集
    for (const id of ids) taken.add(id);
    const cluster = { name, ids };
    created.push(cluster);
    createdByName.set(name, cluster);
  }

  return { assigned, created };
}
