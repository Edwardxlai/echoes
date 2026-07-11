"use client";

import { useState } from "react";
import { VIDEO_TYPE_LABEL, type VideoType } from "@/lib/data";

const ORDER: VideoType[] = ["argument", "intro", "compare", "concept"];

/* AI 建议脉络骨架类型 + 用户一键切换（PRD §6.1.3）：内部选模板的轻机制，不是核心卖点，
   只露一个可改的类型标签。切换只改标签展示，不重新生成脉络（本轮无后端）。 */
export function VideoTypeTag({
  initial,
  confidence,
}: {
  initial: VideoType;
  confidence: number;
}) {
  const [type, setType] = useState(initial);
  const lowConfidence = confidence < 0.7;

  return (
    <button
      className="typeTag"
      onClick={() => setType(ORDER[(ORDER.indexOf(type) + 1) % ORDER.length])}
      title="AI 建议的脉络骨架类型，点击可切换"
    >
      AI 建议 · {VIDEO_TYPE_LABEL[type]}
      {lowConfidence ? "（置信度较低）" : ""}
    </button>
  );
}
