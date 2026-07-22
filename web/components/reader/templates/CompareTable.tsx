import { Fragment } from "react";
import type { CompareRenderData } from "@/lib/analysis-contract";

/* 对比类：纯黑白网格。最后一列约定为「结论」，加重墨色；某维度视频未给出时留「—」，
   不硬编内容。列数随 dimensions 动态，边线用「容器上+左、单元右+下」拼成单线网格。 */
export function CompareTable({ data }: { data: CompareRenderData }) {
  const lastDim = data.dimensions.length - 1;
  return (
    <div className="cmp">
      <div
        className="cmp__grid"
        style={{ gridTemplateColumns: `118px repeat(${data.dimensions.length}, 1fr)` }}
      >
        <div className="cmp__cell cmp__dim" />
        {data.dimensions.map((d, i) => (
          <div key={i} className="cmp__cell cmp__dim">
            {d}
          </div>
        ))}
        {data.rows.map((r, ri) => (
          <Fragment key={ri}>
            <div className="cmp__cell cmp__rowlabel">
              {r.label}
              {r.sub && <small>{r.sub}</small>}
            </div>
            {data.dimensions.map((_, di) => {
              const v = r.cells[di];
              if (v == null)
                return (
                  <div key={di} className="cmp__cell cmp__empty" title="视频未给出该维度">
                    —
                  </div>
                );
              return (
                <div key={di} className={`cmp__cell${di === lastDim ? " cmp__concl" : ""}`}>
                  {v}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      <p className="cmp__verdict">
        <b>{data.verdictLead}</b>：{data.verdict}
      </p>
    </div>
  );
}
