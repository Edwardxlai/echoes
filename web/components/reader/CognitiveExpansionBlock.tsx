"use client";

import { useState } from "react";
import Link from "next/link";
import type { CognitiveExpansion } from "@/lib/data";
import { FocusMark } from "./EchoBlock";

/* 认知·拓展：两个节点（补缺/延伸）挂在一根发丝线上——脉络的点线语言，
   点亮哪个节点，下方浮现哪块素色板，一次只看一块。
   两块板共用同一副书摘卡骨架（参照 Readwise Daily Review / 微信读书分享卡）：
   条目 = 18px 宋体正文；补缺戳破+补上连读成一段，内容自己说话。
   延伸条目点开出 AI 的 hint 和一扇统一的"去讨论"门（暖金高亮，本页零输入框）。
   门不显人数；topicBase（video.{id}|collection.{id}，讨论区收拢版）在则门通向
   对应置顶帖（/topic/{topicBase}?reply=pin-{i}）——延伸点本身就是那条帖。 */

type TabKey = "补缺" | "延伸";

/* 延伸固定展示前 2 条置顶帖（docs/我的岛屿_功能设计.md §2.3，与
   lib/server/discussion.ts 的 PINNED_MAX 同一口径）：存量第 3 条不再展示，
   不必为此全量重跑管线。 */
const PINNED_MAX = 2;

const hang = (s: string) => (/^[「《『【]/.test(s) ? " hang" : "");

/* 抖音搜索页只认路径里的关键词，aid 是端上随机生成的追踪参数，可省略 */
const douyinSearchUrl = (term: string) =>
  `https://www.douyin.com/jingxuan/search/${encodeURIComponent(term)}?type=general`;

export function CognitiveExpansionBlock({
  data,
  topicBase,
}: {
  data: CognitiveExpansion;
  topicBase?: string;
}) {
  const gap = data.gapFill.gap ?? "";
  const fill = data.gapFill.fill ?? "";
  // 各块有内容才占一个 tab：补缺靠承重空洞（门控）、延伸靠开放问题
  // 单视频与合集共用本组件；两块都各自门控，缺哪块就不出对应 tab
  const tabs: TabKey[] = [
    ...(gap ? (["补缺"] as TabKey[]) : []),
    ...(data.extend.length ? (["延伸"] as TabKey[]) : []),
  ];
  const [tab, setTab] = useState<TabKey>(tabs[0] ?? "延伸");
  // 各条目独立开合（同脉络节点），不做"开一个关一个"的单开位
  const [openSet, setOpenSet] = useState<ReadonlySet<number>>(new Set());
  const toggleOpen = (i: number) =>
    setOpenSet((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  // 补缺只有一条，gap 常驻当引子，fill 收放（点开才补上背景）
  const [gapOpen, setGapOpen] = useState(false);

  if (!tabs.length) return null;

  return (
    <>
      <div className="xnav" role="tablist">
        {tabs.map((t, i) => (
          <span key={t} style={{ display: "contents" }}>
            {i > 0 && <span className="xlink" aria-hidden />}
            <button
              className={`xnode${t === tab ? " on" : ""}`}
              role="tab"
              aria-selected={t === tab}
              onClick={() => setTab(t)}
            >
              <span className="xdot" />
              <span className="xname">{t}</span>
            </button>
          </span>
        ))}
      </div>

      <div className="xpanel" key={tab}>
        {tab === "补缺" && (
          // 与延伸共用同一副 .xentry/.think 骨架：gap 常驻当引子，点开才收放出 fill 补上的背景
          <div
            className={`xentry think${gapOpen ? " open" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => setGapOpen((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setGapOpen((v) => !v);
            }}
          >
            <div className="xqrow">
              <div className={`xq${hang(gap)}`}>{gap.replace(/。$/, "")}</div>
              <span className="xtoggle" aria-hidden>
                {gapOpen ? "−" : "+"}
              </span>
            </div>
            {fill && (
              <div className="tframe">
                <div className="tframe-in">
                  <p className={`xg-fill${hang(fill)}`}>
                    <FocusMark text={fill} focus={data.gapFill.focus} />
                  </p>
                  {Boolean(data.gapFill.searchTerms?.length) && (
                    <div className="xsearch">
                      <span className="xsearch-lead">去抖音搜</span>
                      {data.gapFill.searchTerms!.map((term) => (
                        <a
                          key={term}
                          className="src"
                          href={douyinSearchUrl(term)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="src-no">搜</span>
                          <span className="src-t">{term}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "延伸" &&
          data.extend.slice(0, PINNED_MAX).map((item, i) => {
            const open = openSet.has(i);
            return (
              <div
                key={i}
                className={`xentry think${open ? " open" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => toggleOpen(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") toggleOpen(i);
                }}
              >
                <div className="xqrow">
                  <div className={`xq${hang(item.question)}`}>{item.question}</div>
                  <span className="xtoggle" aria-hidden>
                    {open ? "−" : "+"}
                  </span>
                </div>
                <div className="tframe">
                  <div className="tframe-in">
                    {item.hint}
                    {topicBase ? (
                      <Link
                        className="door door--topic"
                        href={`/topic/${topicBase}?reply=pin-${i}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        去讨论 →
                      </Link>
                    ) : (
                      <span className="door">去讨论 →</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </>
  );
}
