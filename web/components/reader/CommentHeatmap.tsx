"use client";

import { useState } from "react";
import type { CommentHeat } from "@/lib/reader/comment-heat";

/* 评论主题热度（重构方案 §8）：黑竖条=讨论热度，默认选中最热主题，点柱切换下方焦点+代表评论。
   不是讨论区，只做理解增强，帮用户找到「值得记一句」的争议点。示例/聚合数据，见 §8.3。 */
export function CommentHeatmap({ data }: { data: CommentHeat }) {
  const [sel, setSel] = useState(0); // topics 已按热度降序，默认最热
  const max = Math.max(...data.topics.map((t) => t.heat), 1);
  const t = data.topics[sel];

  return (
    <div className="heat">
      <div className="heat__head">
        <span className="heat__lead">大家在争论什么</span>
        <span className="heat__note">{data.note}</span>
      </div>
      <div className="heat__row" role="tablist" aria-label="评论主题热度">
        {data.topics.map((tp, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === sel}
            className="heat__bar"
            onClick={() => setSel(i)}
          >
            <span className="heat__track">
              <span className="heat__col" style={{ height: `${Math.round((tp.heat / max) * 100)}%` }}>
                <span className="heat__val">{tp.heat}</span>
              </span>
            </span>
            <span className="heat__lb">{tp.label}</span>
          </button>
        ))}
      </div>
      <div className="heat__panel" aria-live="polite">
        <p className="heat__focus">{t.focus}</p>
        <blockquote className="heat__quote">
          <span className="heat__ql">代表评论</span>
          {t.comment}
        </blockquote>
      </div>
    </div>
  );
}
