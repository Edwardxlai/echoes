import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanVideoTitle,
  MAX_VIDEO_TITLE_LENGTH,
} from "../lib/server/title-utils.mjs";

test("uses the first non-empty line instead of folding the description into the title", () => {
  assert.equal(
    cleanVideoTitle("AI 史诗级泡沫或将崩盘\n这里开始是视频简介，可能非常非常长。"),
    "AI 史诗级泡沫或将崩盘",
  );
});

test("stops at the first sentence and removes Douyin topics", () => {
  assert.equal(
    cleanVideoTitle("普通人如何避险？后面是详细说明。 #财经 #投资"),
    "普通人如何避险？",
  );
});

test("recognizes a flattened title-description boundary without breaking short Latin words", () => {
  assert.equal(
    cleanVideoTitle("AI 史诗级泡沫或将崩盘，普通人如何避险 曾多次精准预测金融泡沫"),
    "AI 史诗级泡沫或将崩盘，普通人如何避险",
  );
  assert.equal(
    cleanVideoTitle("KKR与杠杆收购 Chapter One 它是创造者，也是破坏者"),
    "KKR与杠杆收购 Chapter One",
  );
});

test("hard-caps title length with an ellipsis", () => {
  const title = cleanVideoTitle("这是一段没有任何句号而且会一直继续下去的超长视频简介标题用于验证最终边界不会失效");
  assert.equal(Array.from(title).length, MAX_VIDEO_TITLE_LENGTH);
  assert.ok(title.endsWith("…"));
});
