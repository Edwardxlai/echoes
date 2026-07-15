import type { SynthesisPoint } from "@/lib/data";
import { EchoBlock } from "./EchoBlock";

/* 跨视频知识点 + 关系 + 溯源（PRD §6.4.2）：关系优先，不是系列脉络。
   p.echo 是这个知识点与用户历史观看的连接（§6.4.4，机制同 §6.2，
   跟组内视频互相印证/对撞是两件事，不占用"回响"字样以外的地方）。 */
export function SynthesisPoints({ points }: { points: SynthesisPoint[] }) {
  return (
    <>
      {points.map((p, i) => (
        <div className="kp" key={i}>
          <div className="kp-rel">{p.relation}</div>
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
              来源：
              {p.sources.map((s, j) => (
                <span key={s.videoId}>
                  {j === 0 ? <b>《{s.title}》</b> : <>《{s.title}》</>}
                  {j < p.sources.length - 1 ? " " : ""}
                </span>
              ))}
            </div>
            {p.echo && <EchoBlock echo={p.echo} />}
          </div>
        </div>
      ))}
    </>
  );
}
