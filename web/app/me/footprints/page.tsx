"use client";

import { useState } from "react";
import Link from "next/link";
import { fmtAgo } from "@/lib/discussion";
import { useFootprints, useThoughts } from "@/lib/client/journal";
import { BrandHomeLink } from "@/components/brand/BrandHomeLink";

/** 相对时间只在这算一次——不在 JSX 里直接调 Date.now()（渲染要保持纯函数）。 */
const relTime = (ms: number) => fmtAgo((Date.now() - ms) / 3.6e6);

/** 足迹岛只留最近的探索历史，不做无限增长的日志。 */
const RECENT_FOOTPRINT_LIMIT = 10;

/* 足迹岛：最近的探索轨迹，复用脉络组件的节点/连线/展开方式（docs/我的岛屿_功能设计.md §5.2）。
   节点两种个人状态：看过/解析过、留下过想法——后者是前者的子集，靠一枚素色徽标区分，
   不借用回响的暖金（暖金全站只属于回响，见 reader.css 头注释）。
   点开节点展示我在该内容下留下的想法，没有就只显示轻量的"看过"信息。 */
export default function MyFootprintsPage() {
  const allFootprints = useFootprints();
  const footprints = allFootprints.slice(0, RECENT_FOOTPRINT_LIMIT);
  const thoughts = useThoughts();
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());

  const toggle = (videoId: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });

  return (
    <div className="doc">
      <BrandHomeLink className="readerBrand" />
      <Link className="backlink" href="/me">
        ← 我的岛屿
      </Link>
      <h1 className="display display--question">足迹岛</h1>

      {allFootprints.length > RECENT_FOOTPRINT_LIMIT && (
        <p className="tempty">
          共探索过 {allFootprints.length} 座岛屿，这里显示最近 {RECENT_FOOTPRINT_LIMIT} 条。
        </p>
      )}

      {footprints.length === 0 ? (
        <p className="tempty">还没走过路——去世界地图看条视频。</p>
      ) : (
        <div className="spine">
          {footprints.map((f) => {
            const mine = thoughts.filter((t) => t.videoId === f.videoId);
            const isOpen = openIds.has(f.videoId);
            return (
              <div
                key={f.videoId}
                className={`node${isOpen ? " open" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => toggle(f.videoId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") toggle(f.videoId);
                }}
              >
                <span className="ts">{relTime(f.lastSeenAt)}</span>
                <span className="dot" />
                <div className="nbody">
                  <div className="nlabel">
                    <span className="ltext">
                      《{f.videoTitle}》{f.collectionTitle ? ` · ${f.collectionTitle}` : ""}
                    </span>
                    {mine.length > 0 && <span className="footmark">✎ 留过想法</span>}
                  </div>
                  <div className="detail">
                    <div className="dtext">
                      {mine.length === 0 ? (
                        <p>看过 · 解析过，还没在这留下想法。</p>
                      ) : (
                        mine.map((t) => <p key={t.id}>{t.body}</p>)
                      )}
                    </div>
                    <Link className="door" href={`/video/${f.videoId}`}>去看看 →</Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="colophon">✦</div>
    </div>
  );
}
