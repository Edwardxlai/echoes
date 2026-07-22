"use client";

import { useState } from "react";
import type { HistoryRenderData } from "@/lib/analysis-contract";
import { EchoBlock, FocusMark } from "../EchoBlock";

/* 历史类：横向时间轴选点 + 详情卡。带回响的节点圆点转暖金，选中态实心；
   回响仍收进详情卡内部，交给 EchoBlock（与脉络同一套暖金规则）。 */
export function HistoryTimeline({ data }: { data: HistoryRenderData }) {
  const events = data.events;
  const initial =
    data.defaultIndex != null && data.defaultIndex >= 0 && data.defaultIndex < events.length
      ? data.defaultIndex
      : 0;
  const [sel, setSel] = useState(initial);
  const n = events[sel];

  return (
    <div className="tl">
      <div className="tl__rail">
        <div className="tl__track" role="tablist" aria-label="时间轴">
          {events.map((e, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === sel}
              className={`tl__pt${e.echo ? " echo" : ""}`}
              onClick={() => setSel(i)}
            >
              <span className="tl__yr">{e.year}</span>
              <span className="tl__lb">{e.short}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="tl__card" aria-live="polite">
        <span className="role">
          {n.role} · {n.year}
        </span>
        <h4>{n.title}</h4>
        <p>
          <FocusMark text={n.detail} focus={n.echo?.nodeFocus} />
        </p>
        {n.echo && <EchoBlock echo={n.echo} />}
      </div>
    </div>
  );
}
