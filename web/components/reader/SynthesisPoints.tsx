import Link from "next/link";
import type { SynthesisPoint } from "@/lib/data";
import { EchoBlock } from "./EchoBlock";

/* 跨视频知识点 + 关系 + 溯源（PRD §6.4.2）：关系优先，不是系列脉络。
   relation 收敛成 6 种受控类型（prompt 硬约束），各自配色标记，读起来成体系。
   p.echo 是这个知识点与用户历史观看的连接（§6.4.4，机制同 §6.2）。 */

/** 6 种受控关系 → 色调类。未登记的关系落中性，不报错。 */
const REL_TONE: Record<string, string> = {
  互相印证: "kp-rel--yes",
  拼图互补: "kp-rel--yes",
  层层递进: "kp-rel--deep",
  正面对撞: "kp-rel--no",
  纠偏戳破: "kp-rel--amber",
  理论案例: "kp-rel--neutral",
};

export function SynthesisPoints({ points }: { points: SynthesisPoint[] }) {
  return (
    <>
      {points.map((p, i) => (
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
            <div className="note">{p.note}</div>
            <div className="srcs">
              {p.sources.map((s, j) => (
                <Link className="src" key={s.videoId} href={`/video/${s.videoId}`}>
                  <i className="src-no">{j + 1}</i>
                  <span className="src-t">{s.title}</span>
                  {s.timestampText && <em className="src-ts">{s.timestampText}</em>}
                </Link>
              ))}
            </div>
            {p.echo && <EchoBlock echo={p.echo} />}
          </div>
        </div>
      ))}
    </>
  );
}
