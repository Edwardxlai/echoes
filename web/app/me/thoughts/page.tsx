"use client";

import Link from "next/link";
import { fmtAgo } from "@/lib/discussion";
import { useThoughts } from "@/lib/client/journal";
import { BrandHomeLink } from "@/components/brand/BrandHomeLink";

/** 相对时间只在这算一次——不在 JSX 里直接调 Date.now()（渲染要保持纯函数）。 */
const relTime = (ms: number) => fmtAgo((Date.now() - ms) / 3.6e6);

/* 想法岛：记过的所有想法平铺列表（docs/我的岛屿_功能设计.md §5.1）。
   每条带引用锚点，可跳回原文；已发表的额外给一条去讨论空间的路。 */
export default function MyThoughtsPage() {
  const thoughts = useThoughts();

  return (
    <div className="doc">
      <BrandHomeLink className="readerBrand" />
      <Link className="backlink" href="/me">
        ← 我的岛屿
      </Link>
      <h1 className="display display--question">想法岛</h1>

      {thoughts.length === 0 ? (
        <p className="tempty">还没记下过想法——看条视频时随手记一句。</p>
      ) : (
        <div className="tstream">
          {thoughts.map((t) => (
            <div className="tpost" key={t.id}>
              <span className="tpdot" />
              <div className="tpbody">
                <div className="tpwho">
                  <span className="tpname">《{t.videoTitle}》</span>
                  <span className="tptime">{relTime(t.createdAt)}</span>
                </div>
                {t.anchor && (
                  <div className={`pquote${t.anchor.kind === "echo" ? " pquote--echo" : ""}`}>
                    <span className="pqt">
                      {t.anchor.kind === "echo" && "✦ "}
                      {t.anchor.text}
                    </span>
                  </div>
                )}
                <div className="tptext">{t.body}</div>
                <div className="tpacts">
                  <Link href={t.href}>跳回原文 →</Link>
                  {t.published && (
                    <Link href={`/topic/video.${t.videoId}`}>去讨论区看看 →</Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="colophon">✦</div>
    </div>
  );
}
