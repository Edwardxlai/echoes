"use client";

import { useState } from "react";
import type { CognitiveExpansion } from "@/lib/data";
import { FocusMark } from "./EchoBlock";

const hang = (text: string) => (/^[「《『【]/.test(text) ? " hang" : "");

const douyinSearchUrl = (term: string) =>
  `https://www.douyin.com/jingxuan/search/${encodeURIComponent(term)}?type=general`;

/** Phase 0: 延伸退出，只保留可核对的补缺内容。 */
export function CognitiveExpansionBlock({ data }: { data: CognitiveExpansion }) {
  const gap = data.gapFill.gap ?? "";
  const fill = data.gapFill.fill ?? "";
  const [open, setOpen] = useState(false);

  if (!gap) return null;

  return (
    <div className="xpanel">
      <div
        className={`xentry think${open ? " open" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") setOpen((value) => !value);
        }}
      >
        <div className="xqrow">
          <div className={`xq${hang(gap)}`}>{gap.replace(/。$/, "")}</div>
          <span className="xtoggle" aria-hidden>{open ? "−" : "+"}</span>
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
                      onClick={(event) => event.stopPropagation()}
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
    </div>
  );
}
