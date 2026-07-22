"use client";

import { useState } from "react";
import Link from "next/link";
import { fmtAgo } from "@/lib/time";
import { useFootprints, useThoughts } from "@/lib/client/journal";
import { BrandHomeLink } from "@/components/brand/BrandHomeLink";
import { BackLink } from "@/components/nav/BackLink";

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
      <BackLink className="backlink" href="/me">
        ← 返回
      </BackLink>
      <h1 className="display display--question">足迹岛</h1>
      <p className="footprintsLede">最近走过的内容，只为你保留。</p>

      {allFootprints.length > RECENT_FOOTPRINT_LIMIT && (
        <p className="tempty">
          共探索过 {allFootprints.length} 座岛屿，这里显示最近 {RECENT_FOOTPRINT_LIMIT} 条。
        </p>
      )}

      {footprints.length === 0 ? (
        <p className="tempty">还没走过路——去世界地图看条视频。</p>
      ) : (
        <div className="footprintList">
          {footprints.map((f) => {
            const mine = thoughts.filter((t) => t.videoId === f.videoId);
            const isOpen = openIds.has(f.videoId);
            const detailId = `footprint-${f.videoId}-detail`;
            return (
              <article
                key={f.videoId}
                className={`footprint${isOpen ? " footprint--open" : ""}`}
              >
                <time className="footprintTime">{relTime(f.lastSeenAt)}</time>
                <span className="footprintDot" aria-hidden="true" />
                <div className="footprintBody">
                  <button
                    className="footprintToggle"
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={detailId}
                    onClick={() => toggle(f.videoId)}
                  >
                    <span className="footprintCopy">
                      <span className="footprintTitle">《{f.videoTitle}》</span>
                      {f.collectionTitle && <span className="footprintMeta">{f.collectionTitle}</span>}
                    </span>
                    <span className="footprintState">
                      {mine.length > 0 && <span className="footprintMark">留过想法</span>}
                      <span className="footprintCaret" aria-hidden="true">⌄</span>
                    </span>
                  </button>

                  <div className="footprintReveal" id={detailId} aria-hidden={!isOpen}>
                    <div className="footprintRevealInner">
                      {mine.length > 0 ? (
                        <div className="footprintNotes">
                          <p className="footprintNotesLabel">当时记下</p>
                          {mine.map((thought) => (
                            <div className="footprintNote" key={thought.id}>
                              {thought.anchor && (
                                <p className="footprintContext">
                                  <span>{thought.anchor.label}</span>
                                  {thought.anchor.text}
                                </p>
                              )}
                              <p className="footprintNoteText">{thought.body}</p>
                              <time className="footprintNoteTime">{relTime(thought.createdAt)}</time>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="footprintPassing">这次只是路过，没有留下文字。</p>
                      )}
                      <Link className="footprintDoor" href={`/video/${f.videoId}`}>
                        回到这座岛 <span aria-hidden="true">↗</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="colophon">✦</div>
    </div>
  );
}
