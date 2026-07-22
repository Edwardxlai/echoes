"use client";

import Link from "next/link";
import { useState } from "react";
import type { SynthesisPoint } from "@/lib/data";
import { FacetSpine } from "./SynthesisPoints";

/* 关系棋盘 + 聚焦抽屉（知音_合集解析交互方案_V2）：行=跨视频知识点，列=集数，
   圆点=该集为这个知识点提供来源。点一行，下方固定抽屉原地更新——整页只有一个展开机关。
   抽屉正文直接复用 FacetSpine（单视频脉络同构），不第二次设计知识点的排版。 */
export function KnowledgeMatrix({ points, videoIds }: { points: SynthesisPoint[]; videoIds: string[] }) {
  const [active, setActive] = useState(0);
  const order = new Map(videoIds.map((id, i) => [id, i + 1]));
  const dirNo = (videoId: string) => order.get(videoId);

  if (!points.length) {
    return (
      <p style={{ padding: "24px 0", color: "var(--ink-3)", fontSize: 14 }}>
        这组内容之间的跨视频关联还不够多，暂时生成不出知识点合成——单集解析仍然可用，见上方集数索引。
      </p>
    );
  }

  const activeIndex = Math.min(active, points.length - 1);
  const activePoint = points[activeIndex];
  const srcs = [...activePoint.sources].sort(
    (a, b) => (dirNo(a.videoId) ?? 99) - (dirNo(b.videoId) ?? 99),
  );

  return (
    <>
      <div className="matrixWrap">
        <table className="matrix">
          <thead>
            <tr>
              <th className="rowhead" />
              {videoIds.map((videoId, i) => (
                <th key={videoId}>
                  <Link href={`/video/${videoId}`}>{String(i + 1).padStart(2, "0")}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => {
              const covered = new Set(p.sources.map((s) => s.videoId));
              const isActive = i === activeIndex;
              return (
                <tr
                  key={i}
                  className={isActive ? "rowActive" : undefined}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  onClick={() => setActive(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActive(i); }
                  }}
                >
                  <td className="rowlabel">{p.label}</td>
                  {videoIds.map((videoId) => (
                    <td key={videoId}>
                      {covered.has(videoId) ? <span className="dotf" /> : <span className="dote" />}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="focusDrawer">
        <div className="fd-kick">当前聚焦</div>
        <div className="kp-q">{activePoint.label}</div>
        {activePoint.facets?.length ? (
          <FacetSpine facets={activePoint.facets} sources={activePoint.sources} dirNo={dirNo} />
        ) : (
          activePoint.note && <div className="note">{activePoint.note}</div>
        )}
        <div className="srcs">
          {srcs.map((s) => (
            <Link className="src" key={s.videoId} href={`/video/${s.videoId}`}>
              <i className="src-no">{dirNo(s.videoId) ?? "·"}</i>
              <span className="src-t">{s.title}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
