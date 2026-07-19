"use client";

import Link from "next/link";
import { useState } from "react";
import type { SynthesisPoint, SynthesisFacet } from "@/lib/data";
import { EchoBlock, FocusMark } from "./EchoBlock";

/* 跨视频知识点 + 关系 + 溯源（PRD §6.4.2）：关系优先，不是系列脉络。
   relation 收敛成 6 种受控类型（prompt 硬约束），各自配色标记，读起来成体系。
   要点直接复用单视频脉络的对齐轴（.spine/.node）：左轨=固定档位标签，收起看 label、
   点开看 detail；档位重复时加序号（佐证一/佐证二），和脉络的 role 同一套。
   没有 facets 的老数据回退成一段 note。p.echo 是这条与历史观看的连接（§6.4.4）。 */

/** 6 种受控关系 → 色调类。未登记的关系落中性，不报错。 */
const REL_TONE: Record<string, string> = {
  互相印证: "kp-rel--yes",
  拼图互补: "kp-rel--yes",
  层层递进: "kp-rel--deep",
  正面对撞: "kp-rel--no",
  纠偏戳破: "kp-rel--amber",
  理论案例: "kp-rel--neutral",
};

const CN_NUM = ["一", "二", "三", "四", "五", "六", "七"];

/** 同一档位重复时加序号（"佐证"×2 → 佐证一/佐证二），照搬脉络的 displayRoles。 */
function displayLeads(facets: SynthesisFacet[]): (string | undefined)[] {
  const total = new Map<string, number>();
  for (const f of facets) if (f.lead) total.set(f.lead, (total.get(f.lead) ?? 0) + 1);
  const seen = new Map<string, number>();
  return facets.map((f) => {
    if (!f.lead) return undefined;
    if ((total.get(f.lead) ?? 0) < 2) return f.lead;
    const i = (seen.get(f.lead) ?? 0) + 1;
    seen.set(f.lead, i);
    const stem = f.lead.length >= 3 ? f.lead.slice(0, 2) : f.lead;
    return `${stem}${CN_NUM[i - 1] ?? i}`;
  });
}

type SrcRef = SynthesisPoint["sources"][number];

/** 可展开要点轴：与单视频 Spine 同构（左轨档位｜墨点｜标题+展开正文）。
    角标显示的是溯源视频在合集里的固定编号（dirNo），跨知识点一致。 */
function FacetSpine({ facets, sources, dirNo }: {
  facets: SynthesisFacet[]; sources: SrcRef[]; dirNo: (videoId: string) => number | undefined;
}) {
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const leads = displayLeads(facets);
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="spine">
      {facets.map((f, i) => {
        const isOpen = open.has(i);
        // 兼容旧数据：只有 text 的老 facet 拿 text 当标题，无展开正文
        const title = f.label || f.text || "";
        const body = f.detail || "";
        // refs 是点内 sources 的序号；旧数据的单个 ref 仍然兼容。
        const refIndexes = f.refs?.length ? f.refs : (f.ref != null ? [f.ref] : []);
        const refSources = refIndexes
          .map((ref) => sources[ref - 1])
          .filter((source): source is SrcRef => Boolean(source));
        return (
          <div
            key={i}
            className={`node${isOpen ? " open" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => toggle(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") toggle(i);
            }}
          >
            <span className={leads[i] ? "ts role" : "ts"}>{leads[i]}</span>
            <span className="dot" />
            <div className="nbody">
              <div className="nlabel">
                <span className="ltext">
                  {title}
                  {refSources.map((source) => {
                    const no = dirNo(source.videoId);
                    return no != null ? (
                      <sup className="kp-ref" key={source.videoId} title={`来自：${source.title}`}>{no}</sup>
                    ) : null;
                  })}
                </span>
              </div>
              {body && (
                <div className="detail">
                  <div className="dtext">
                    <FocusMark text={body} focus={f.focus} />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** videoIds 是该合集视频的目录顺序（与集数索引 01/02… 一致）；角标与溯源都按它编号。 */
export function SynthesisPoints({ points, videoIds = [] }: { points: SynthesisPoint[]; videoIds?: string[] }) {
  const order = new Map(videoIds.map((id, i) => [id, i + 1]));
  const dirNo = (videoId: string) => order.get(videoId);
  return (
    <>
      {points.map((p, i) => {
        // 溯源列表按目录编号升序，读起来 ①②③ 而非按点内相关度乱序
        const srcs = [...p.sources].sort(
          (a, b) => (dirNo(a.videoId) ?? 99) - (dirNo(b.videoId) ?? 99),
        );
        return (
          <div className="kp" key={i}>
            <div className={`kp-rel ${REL_TONE[p.relation] ?? "kp-rel--neutral"}`}>{p.relation}</div>
            <div className="kp-body">
              <div className="kp-q">{p.label}</div>
              {p.stance && (
                <div className="stance">
                  {p.stance.map((s, j) => (
                    <span key={j} className={`pill ${s.tag}`}>
                      {s.text}
                    </span>
                  ))}
                </div>
              )}
              {p.facets?.length ? (
                <FacetSpine facets={p.facets} sources={p.sources} dirNo={dirNo} />
              ) : (
                p.note && <div className="note">{p.note}</div>
              )}
              <div className="srcs">
                {srcs.map((s) => (
                  <Link className="src" key={s.videoId} href={`/video/${s.videoId}`}>
                    <i className="src-no">{dirNo(s.videoId) ?? "·"}</i>
                    <span className="src-t">{s.title}</span>
                    {s.timestampText && <em className="src-ts">{s.timestampText}</em>}
                  </Link>
                ))}
              </div>
              {p.echo && <EchoBlock echo={p.echo} />}
            </div>
          </div>
        );
      })}
    </>
  );
}
