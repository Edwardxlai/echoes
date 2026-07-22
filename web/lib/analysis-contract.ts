import type { Echo } from "./data";
import { semanticAnchorId } from "./semantic-anchor";

export const ANALYSIS_TEMPLATES = [
  "argument",
  "history",
  "compare",
  "data",
  "scenario",
] as const;

export type AnalysisTemplate = (typeof ANALYSIS_TEMPLATES)[number];

export interface SemanticAnchor {
  anchorId: string;
  title: string;
  snippet: string;
  sourceRef: {
    assetId: string;
    timestampText?: string;
  };
}

export interface ArgumentRenderNode {
  id: string;
  anchorId: string;
  concept: string;
  role?: string;
  detail: string;
  timestamp: string;
}

export interface ArgumentRenderData {
  coreQuestion: string;
  summary: string;
  nodes: ArgumentRenderNode[];
  takeaways: string[];
}

export interface TemplateDowngrade {
  template: "argument";
  reason: string;
}

/* ---------- Phase 1 render-data variants（历史 / 对比 / 数据 / 条件推演） ----------
   四类各带一份结构化 renderData；回响一律复用 lib/data 的 Echo，交给 EchoBlock 渲染，
   与论证类脉络同一套「收进节点/条目内部」的暖金规则。 */

export interface HistoryEvent {
  year: string;      // "1950" / "2006–12"
  short: string;     // 时间轴上的简称，如「图灵测试」
  role: string;      // 环节名：前因 / 经过 / 影响
  title: string;
  detail: string;
  echo?: Echo;
}
export interface HistoryRenderData {
  coreQuestion: string;
  events: HistoryEvent[];
  defaultIndex?: number;
}

export interface CompareRow {
  label: string;
  sub?: string;              // 行名下的小字标注，如「如 浩华」
  cells: (string | null)[];  // 与 dimensions 等长；null = 该维度视频未给出
}
export interface CompareRenderData {
  coreQuestion: string;
  dimensions: string[];      // 维度列名，最后一列约定为「结论」，渲染加重
  rows: CompareRow[];
  verdictLead: string;       // 「视频结论」等引导词
  verdict: string;
}

export interface DataBar {
  label: string;
  sub?: string;
  value: string;             // 展示值，如「≥90」「<10」
  unit?: string;             // 「%」
  pct: number;               // 条宽 0–100
  kind: "primary" | "sub" | "echo"; // echo=整条暖金
}
export interface DataRenderData {
  coreQuestion: string;
  chartTitle: string;
  unit: string;              // 口径注记
  bars: DataBar[];
  echo?: Echo;
}

export type ScenarioDeform = "none" | "shift" | "broken" | "fork";
export interface ScenarioStep {
  deform: ScenarioDeform;
  tag: string;
  title: string;
  detail: string;
}
export interface ScenarioRenderData {
  coreQuestion: string;
  condition: string;         // 可调条件的问句
  offState: string;          // 开关关：「否（史实）」
  onState: string;           // 开关开：「是（反事实）」
  premise: ScenarioStep & { echo?: Echo }; // 恒定前提（不随开关变）
  off: ScenarioStep[];
  on: ScenarioStep[];
}

export type TemplateRenderData =
  | ArgumentRenderData
  | HistoryRenderData
  | CompareRenderData
  | DataRenderData
  | ScenarioRenderData;

/** Phase 0 contract. New template render-data variants are added without changing this envelope. */
export interface AnalysisDispatch {
  template: AnalysisTemplate;
  confidence: number;
  downgrade: TemplateDowngrade;
  renderData: TemplateRenderData;
}

export function withSemanticAnchors<T extends { id?: unknown; anchorId?: unknown; concept: string }>(
  nodes: T[],
): (T & { id: string; anchorId: string })[] {
  return nodes.map((node, index) => ({
    ...node,
    id: node.id != null && node.id !== "" ? String(node.id) : `node-${index + 1}`,
    anchorId:
      typeof node.anchorId === "string" && node.anchorId
        ? node.anchorId
        : semanticAnchorId(node.concept),
  }));
}

export function createArgumentDispatch(input: {
  coreQuestion: string;
  summary?: string;
  nodes: ArgumentRenderNode[];
  takeaways?: string[];
  confidence?: number;
  reason?: string;
}): AnalysisDispatch {
  return {
    template: "argument",
    confidence: Math.max(0, Math.min(1, Number(input.confidence) || 0)),
    downgrade: {
      template: "argument",
      reason: input.reason ?? "phase0-argument-baseline",
    },
    renderData: {
      coreQuestion: input.coreQuestion,
      summary: input.summary ?? "",
      nodes: withSemanticAnchors(input.nodes),
      takeaways: input.takeaways ?? [],
    },
  };
}

const clamp01 = (n: unknown) => Math.max(0, Math.min(1, Number(n) || 0));

/** 各模板 renderData 的最小完整性校验——不达标就退回论证类。 */
function isRenderDataComplete(template: AnalysisTemplate, rd: TemplateRenderData): boolean {
  switch (template) {
    case "argument":
      return "nodes" in rd && Array.isArray(rd.nodes) && rd.nodes.length > 0;
    case "history":
      return "events" in rd && Array.isArray(rd.events) && rd.events.length > 0;
    case "compare":
      return (
        "rows" in rd && Array.isArray(rd.rows) && rd.rows.length > 0 &&
        Array.isArray(rd.dimensions) && rd.dimensions.length > 0
      );
    case "data":
      return "bars" in rd && Array.isArray(rd.bars) && rd.bars.length > 0;
    case "scenario":
      return "on" in rd && Array.isArray(rd.on) && rd.on.length > 0 && Array.isArray(rd.off);
    default:
      return false;
  }
}

/** Unsupported or incomplete templates always resolve to the argument baseline. */
export function resolveAnalysisDispatch(dispatch: AnalysisDispatch): AnalysisDispatch {
  const rd = dispatch.renderData;
  if (rd && isRenderDataComplete(dispatch.template, rd)) {
    if (dispatch.template === "argument") {
      const nodes = (rd as ArgumentRenderData).nodes;
      return {
        ...dispatch,
        confidence: clamp01(dispatch.confidence),
        renderData: { ...(rd as ArgumentRenderData), nodes: withSemanticAnchors(nodes) },
      };
    }
    return { ...dispatch, confidence: clamp01(dispatch.confidence) };
  }
  const nodes = rd && "nodes" in rd ? rd.nodes : undefined;
  return createArgumentDispatch({
    coreQuestion: (rd && "coreQuestion" in rd ? rd.coreQuestion : "") ?? "",
    summary: rd && "summary" in rd ? rd.summary : "",
    nodes: Array.isArray(nodes) ? nodes : [],
    takeaways: rd && "takeaways" in rd ? rd.takeaways : [],
    confidence: dispatch.confidence,
    reason: dispatch.downgrade?.reason || "unsupported-or-incomplete-template",
  });
}

