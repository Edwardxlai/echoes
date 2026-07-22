import type { Node } from "@/lib/data";
import type {
  AnalysisDispatch,
  CompareRenderData,
  DataRenderData,
  HistoryRenderData,
  ScenarioRenderData,
} from "@/lib/analysis-contract";
import { resolveAnalysisDispatch } from "@/lib/analysis-contract";
import { Spine } from "./Spine";
import { HistoryTimeline } from "./templates/HistoryTimeline";
import { CompareTable } from "./templates/CompareTable";
import { DataChart } from "./templates/DataChart";
import { ScenarioSandbox } from "./templates/ScenarioSandbox";

/* 模板分发：resolveAnalysisDispatch 已保证 template 只在 renderData 完整时保持非论证类，
   否则退回论证类脉络（Spine 用真实 nodes 渲染）。故此处按类型断言取用 renderData 是安全的。 */
export function AnalysisRenderer({
  dispatch,
  nodes,
}: {
  dispatch: AnalysisDispatch;
  nodes: Node[];
}) {
  const resolved = resolveAnalysisDispatch(dispatch);
  switch (resolved.template) {
    case "history":
      return <HistoryTimeline data={resolved.renderData as HistoryRenderData} />;
    case "compare":
      return <CompareTable data={resolved.renderData as CompareRenderData} />;
    case "data":
      return <DataChart data={resolved.renderData as DataRenderData} />;
    case "scenario":
      return <ScenarioSandbox data={resolved.renderData as ScenarioRenderData} />;
    case "argument":
    default:
      return <Spine nodes={nodes} />;
  }
}
