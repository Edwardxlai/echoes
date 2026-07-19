import assert from "node:assert/strict";
import test from "node:test";
import { planRecluster } from "../lib/server/recluster-plan.mjs";

const miscIds = ["v1", "v2", "v3", "v4", "v5"];
const existing = [
  { id: "tc-aaa", name: "美元霸权与去美元化" },
  { id: "tc-bbb", name: "三国人物志" },
];

test("assigns misc videos into known collections and ignores unknown ids", () => {
  const plan = planRecluster(
    {
      assign: [
        { videoId: "v1", collectionId: "tc-aaa" },
        { videoId: "v9", collectionId: "tc-aaa" }, // 不在散篇集
        { videoId: "v2", collectionId: "tc-zzz" }, // 合集不存在
      ],
    },
    miscIds,
    existing,
  );
  assert.deepEqual(plan.assigned, [{ videoId: "v1", collectionId: "tc-aaa" }]);
  assert.deepEqual(plan.created, []);
});

test("a video is only ever moved once, assignment first", () => {
  const plan = planRecluster(
    {
      assign: [
        { videoId: "v1", collectionId: "tc-aaa" },
        { videoId: "v1", collectionId: "tc-bbb" }, // 重复 assign
      ],
      clusters: [{ name: "宏观与通胀", ids: ["v1", "v2", "v3", "v4"] }], // v1 已被占
    },
    miscIds,
    existing,
  );
  assert.deepEqual(plan.assigned, [{ videoId: "v1", collectionId: "tc-aaa" }]);
  assert.deepEqual(plan.created, [{ name: "宏观与通胀", ids: ["v2", "v3", "v4"] }]);
});

test("clusters below 3 valid members are dropped (stay in misc)", () => {
  const plan = planRecluster(
    {
      clusters: [
        { name: "宏观与通胀", ids: ["v1", "v2"] },
        { name: "只剩两条有效", ids: ["v3", "v4", "v9"] }, // v9 无效 → 只剩 2
      ],
    },
    miscIds,
    existing,
  );
  assert.deepEqual(plan.assigned, []);
  assert.deepEqual(plan.created, []);
});

test("cluster whose name duplicates an existing collection merges into it instead of creating a twin", () => {
  const plan = planRecluster(
    { clusters: [{ name: " 美元霸权与去美元化 ", ids: ["v1", "v2", "v3"] }] },
    miscIds,
    existing,
  );
  assert.deepEqual(plan.assigned, [
    { videoId: "v1", collectionId: "tc-aaa" },
    { videoId: "v2", collectionId: "tc-aaa" },
    { videoId: "v3", collectionId: "tc-aaa" },
  ]);
  assert.deepEqual(plan.created, []);
});

test("two clusters with the same name in one response merge into one", () => {
  const plan = planRecluster(
    {
      clusters: [
        { name: "宏观与通胀", ids: ["v1", "v2", "v3"] },
        { name: "宏观与通胀", ids: ["v4", "v5"] },
      ],
    },
    miscIds,
    existing,
  );
  assert.deepEqual(plan.created, [{ name: "宏观与通胀", ids: ["v1", "v2", "v3", "v4", "v5"] }]);
});

test("empty names are dropped, long names truncated to 16 chars", () => {
  const longName = "一二三四五六七八九十甲乙丙丁戊己庚辛";
  const plan = planRecluster(
    {
      clusters: [
        { name: "  ", ids: ["v1", "v2", "v3"] },
        { name: longName, ids: ["v4", "v5"] },
      ],
    },
    ["v1", "v2", "v3", "v4", "v5", "v6"],
    [],
  );
  assert.deepEqual(plan.assigned, []);
  assert.deepEqual(plan.created, []); // 空名簇被扔掉；长名簇只有 2 条也不成簇
  const plan2 = planRecluster(
    { clusters: [{ name: longName, ids: ["v1", "v2", "v3"] }] },
    miscIds,
    existing,
  );
  assert.equal(plan2.created[0].name, longName.slice(0, 16));
});

test("malformed model output degrades to an empty plan", () => {
  assert.deepEqual(planRecluster({}, miscIds, existing), { assigned: [], created: [] });
  assert.deepEqual(
    planRecluster({ assign: [{}], clusters: [{ ids: null }] }, miscIds, existing),
    { assigned: [], created: [] },
  );
});
