import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pipeline = readFileSync(new URL("../lib/server/pipeline.ts", import.meta.url), "utf8");

test("special renderers are selected for complete core sections, not only whole-video dominance", () => {
  assert.match(pipeline, /特殊结构不需要占据整条视频/);
  assert.match(pipeline, /argument 是最后兜底，不是拿不准时的安全项/);
  assert.doesNotMatch(pipeline, /删掉它就无法正确理解内容/);
});

test("data and scenario have positive calibration examples", () => {
  assert.match(pipeline, /A 占 90% 以上、B 占 3%~5%、C 不足 1%/);
  assert.match(pipeline, /你是干皮还是油皮/);
  assert.match(pipeline, /左侧与右侧策略在不确定性、确认时点、风险代价上有何差异/);
  assert.match(pipeline, /应判 compare，不是 scenario/);
  assert.match(pipeline, /data > scenario > compare > history > argument/);
});

test("classification and render-data generation inspect the same transcript window", () => {
  assert.equal([...pipeline.matchAll(/transcript\.slice\(0, 12000\)/g)].length, 2);
  assert.doesNotMatch(pipeline, /transcript\.slice\(0, 6000\)/);
});
