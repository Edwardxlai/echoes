"use client";

import { useState } from "react";
import Link from "next/link";
import type { CognitiveExpansion } from "@/lib/data";

/* 认知·拓展：三个节点（已有/补缺/延伸）挂在一根发丝线上——脉络的点线语言，
   点亮哪个节点，下方浮现哪块素色板，一次只看一块。
   三块板共用同一副书摘卡骨架（参照 Readwise Daily Review / 微信读书分享卡）：
   条目 = 18px 宋体正文 + "——"灰色落款行。落款承载各自的元信息：
   已有=出处，补缺=为什么没有答案，延伸=门口人数。延伸条目点开出 AI 的 hint 和
   进同题讨论的门（门票在讨论区门口收，本页零输入框）。
   讨论区为 P2（PRD §6.5），门口人数暂为种子数据；路由建成后 .door 换成 Link。 */

type TabKey = "已有" | "补缺" | "延伸";

const hang = (s: string) => (/^[「《『【]/.test(s) ? " hang" : "");

export function CognitiveExpansionBlock({
  data,
  mapHref,
  scope = "video",
}: {
  data: CognitiveExpansion;
  mapHref: string;
  scope?: "video" | "collection";
}) {
  const known = data.gapFill.known;
  const tabs: TabKey[] = known.length ? ["已有", "补缺", "延伸"] : ["补缺", "延伸"];
  const [tab, setTab] = useState<TabKey>(tabs[0]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

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
        {tab === "已有" && (
          <>
            {known.map((k, i) => (
              <div className="xentry" key={i}>
                <div className={`xq${hang(k.point)}`}>{k.point}</div>
                <div className="xsrc">
                  ——{" "}
                  {k.fromTitle ? (
                    <>
                      你看过的
                      {k.fromVideoId ? (
                        <Link className="kfrom" href={`/video/${k.fromVideoId}`}>
                          《{k.fromTitle}》
                        </Link>
                      ) : (
                        <>《{k.fromTitle}》</>
                      )}
                    </>
                  ) : scope === "collection" ? (
                    "这组视频里讲过"
                  ) : (
                    "这条视频里刚讲过"
                  )}
                </div>
              </div>
            ))}
            <Link className="cta xmap" href={mapHref}>
              这个话题下你的全部积累 →
            </Link>
          </>
        )}

        {tab === "补缺" && (
          <div className="xentry">
            <div className={`xq${hang(data.gapFill.toClarify)}`}>
              {data.gapFill.toClarify}
            </div>
            <div className="xsrc">—— 这一题，AI 不给答案，留给你</div>
          </div>
        )}

        {tab === "延伸" &&
          data.extend.map((item, i) => {
            const open = openIdx === i;
            return (
              <div
                key={i}
                className={`xentry think${open ? " open" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => setOpenIdx(open ? null : i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setOpenIdx(open ? null : i);
                }}
              >
                <div className="xqrow">
                  <div className={`xq${hang(item.question)}`}>{item.question}</div>
                  <span className="xtoggle" aria-hidden>
                    {open ? "−" : "+"}
                  </span>
                </div>
                <div className="xsrc">
                  ——{" "}
                  {item.voices > 0
                    ? `${item.voices} 人带着判断在这一题下`
                    : "还没有人进来"}
                </div>
                <div className="tframe">
                  <div className="tframe-in">
                    {item.hint}
                    <span className="door">
                      {item.voices > 0 ? "带着你的判断进去 →" : "做第一个 →"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </>
  );
}
