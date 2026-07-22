import type { DataRenderData } from "@/lib/analysis-contract";
import { EchoBlock } from "../EchoBlock";

/* 数据类：横向柱状。带回响的一条整条转暖金（bar__fill--echo + has-echo），无额外标记；
   回响照旧收进图表下方，交给 EchoBlock。 */
const FILL: Record<DataRenderData["bars"][number]["kind"], string> = {
  primary: "bar__fill",
  sub: "bar__fill bar__fill--sub",
  echo: "bar__fill bar__fill--echo",
};

export function DataChart({ data }: { data: DataRenderData }) {
  return (
    <div className="chart">
      <h4 className="chart__title">{data.chartTitle}</h4>
      <p className="chart__unit">{data.unit}</p>
      <div className="bars">
        {data.bars.map((b, i) => (
          <div key={i} className={`bar__row${b.kind === "echo" ? " has-echo" : ""}`}>
            <div className="bar__lb">
              {b.label}
              {b.sub && (
                <>
                  <br />
                  <small>{b.sub}</small>
                </>
              )}
            </div>
            <div className="bar__track">
              <div className={FILL[b.kind]} style={{ width: `${Math.max(0, Math.min(100, b.pct))}%` }} />
            </div>
            <div className="bar__val">
              {b.value}
              {b.unit && <small>{b.unit}</small>}
            </div>
          </div>
        ))}
      </div>
      {data.echo && (
        <div className="chart__echo">
          <EchoBlock echo={data.echo} />
        </div>
      )}
    </div>
  );
}
