/* ================================================================
   Phase 1 · 单视频五模板示例（docs/知音_重构执行计划.md）
   取材 5 条库内真实解析视频，手工编排成五种模板的示例 renderData。
   回响的跳转目标都是库内真实视频，点「看解析」直达。
   分类管线尚未产出模板判定，这里按 videoId 覆盖，作为可评审的样例夹具；
   不写进 DB，避免重解析被冲掉。管线上线后此覆盖可整体退场。
   ================================================================ */

import type { Echo, Node } from "@/lib/data";
import type { AnalysisDispatch, AnalysisTemplate, TemplateRenderData } from "@/lib/analysis-contract";
import { createArgumentDispatch } from "@/lib/analysis-contract";
import { semanticAnchorId } from "@/lib/semantic-anchor";

export interface SampleReader {
  coreQuestion: string;
  dispatch: AnalysisDispatch;
  echoCount: number; // 页头「✦ N 回响」按样例实际回响数显示，不沿用真实 backbone
  nodes?: Node[]; // 仅论证类需要（Spine 从 nodes 渲染）
}

/** 回响：与库内既有回响结构完全一致（方案 D）——头部只出关系词，旧方一句划荧光（oldFocus），
   节点叙述里对应短语也划荧光（nodeFocus，须是该节点 detail 的子串）。跳转目标均为库内真实视频。 */
function echo(
  targetVideoId: string,
  targetTitle: string,
  creator: string,
  relation: string,
  oldSay: string,
  oldFocus: string,
  nodeFocus?: string,
): Echo {
  return { targetVideoId, targetTitle, creator, timestampText: "", relation, oldSay, oldFocus, nodeFocus };
}

function dispatch(template: AnalysisDispatch["template"], renderData: TemplateRenderData): AnalysisDispatch {
  return {
    template,
    confidence: 0.9,
    downgrade: { template: "argument", reason: "phase1-sample-fixture" },
    renderData,
  };
}

/* ---------- 01 论证类 · 欧文·费雪《繁荣与萧条》精读（达叔的财智日记） ---------- */
const ARGUMENT_NODES: Node[] = [
  {
    id: "s1-n1",
    anchorId: semanticAnchorId("过度负债如何埋下隐患"),
    label: "过度负债如何埋下隐患？",
    role: "核心论点",
    timestampText: "0:00",
    detail:
      "费雪指出萧条导火索是过度负债——债务到期集中、资产变现能力弱。当债务与国民收入比率突破临界值，经济便站在悬崖边缘。",
  },
  {
    id: "s1-n2",
    anchorId: semanticAnchorId("九连环的连锁反应"),
    label: "九连环的连锁反应是什么？",
    role: "论据链",
    timestampText: "5:30",
    detail:
      "过度负债触发九个因素相互勾连：廉价销售、货币减少、价格下降、净值缩水、利润亏损、生产下滑、悲观情绪、流通变慢、实际利率飙升，形成债务-通缩螺旋。",
    echo: echo(
      "8ef72aeb",
      "日元暴跌，日本真的撑不住了？",
      "阿库财经Finance",
      "后来呼应",
      "通胀、债务、汇率、工资四者互相咬合，形成现代版螺旋，与九连环的相互勾连同构。",
      "四者互相咬合",
      "相互勾连",
    ),
  },
  {
    id: "s1-n3",
    anchorId: semanticAnchorId("1929 年大萧条如何验证"),
    label: "1929 年大萧条如何验证？",
    role: "关键案例",
    timestampText: "10:00",
    detail:
      "股市崩盘后廉价销售、货币紧缩、价格下跌依次爆发，债务清偿悖论让实际债务反而加重，企业破产、失业飙升，完美复刻九连环。",
    echo: echo(
      "1138db7c",
      "无人生还：万字解析雷曼兄弟崩盘始末",
      "曼萨财经",
      "互相印证",
      "2008 年雷曼破产后股市暴跌、信用市场冻结、失业飙升，债务清偿悖论重现——隔 79 年同一机制再演。",
      "债务清偿悖论重现",
      "债务清偿悖论",
    ),
  },
  {
    id: "s1-n4",
    anchorId: semanticAnchorId("如何打破债务通缩循环"),
    label: "如何打破债务-通缩循环？",
    role: "结论",
    timestampText: "20:00",
    detail:
      "治标（失业救济、债务重组、银行注资）与治本（央行调控货币、稳定物价、国际协调）并举，核心是稳定货币价值，防止债务实际负担放大。",
    echo: echo(
      "69d3078a",
      "本轮巨量化债核心逻辑拆解，降息置换债务，储户承担成本",
      "麟元观察",
      "互相印证",
      "中国 68 万亿化债「借新还旧、降利率」正是减轻利息负担的当代操作，呼应费雪「防止债务实际负担放大」。",
      "减轻利息负担",
      "防止债务实际负担放大",
    ),
  },
];

/* ---------- 02 历史类 · AI简史：从1950到2026（一枚卓子） ---------- */
const HISTORY_DATA: TemplateRenderData = {
  coreQuestion: "AI 是如何从图灵测试发展到今天的？",
  defaultIndex: 1,
  events: [
    {
      year: "1950",
      short: "图灵测试",
      role: "前因",
      title: "图灵测试：机器能思考吗？",
      detail:
        "图灵把哲学问题转成工程测试：若机器聊天令人无法分辨人机，即视为会思考。这为 AI 设定了追求表现而非灵魂的目标，奠定学科 DNA。",
    },
    {
      year: "2006–12",
      short: "深度学习复兴",
      role: "经过",
      title: "深度学习复兴：算法·数据·算力",
      detail:
        "反向传播让机器能复盘错误，CNN 实现手写识别商用，ImageNet 提供海量标注数据，GPU 并行计算加速训练。三要素齐备，深度学习重新崛起。",
      echo: echo(
        "fb8d7f75",
        "英伟达的芯片帝国是如何铸就的？",
        "基地边缘 BaseEdge",
        "历史先例",
        "辛顿团队用 GPU 训练 AI 夺冠，坐实了 GPU 加速这一步。",
        "GPU 训练 AI 夺冠",
        "GPU 并行计算加速训练",
      ),
    },
    {
      year: "2017",
      short: "Transformer",
      role: "经过",
      title: "突破：AlphaGo 到 Transformer",
      detail:
        "AlphaGo 击败围棋冠军，证明 AI 能走人类未走过之路；Transformer 用注意力机制并行处理大量数据，成为其后所有大模型的架构基础。",
    },
    {
      year: "2018–22",
      short: "GPT / ChatGPT",
      role: "经过",
      title: "爆发：GPT 与 ChatGPT 时代",
      detail:
        "OpenAI 用 GPT 系列实现预训练+微调，ChatGPT 上线后用户暴增，引发大模型军备竞赛；国内百度阿里跟进，DeepSeek 以低价冲击市场。",
      echo: echo(
        "ea6dd19d",
        "算力竞赛进入后半场，但终点已经悄然改变",
        "科技公元",
        "互相印证",
        "中国模型性能不敌，却凭成本优势让全球调用量反超——呼应此处的低价冲击。",
        "成本优势",
        "低价冲击市场",
      ),
    },
    {
      year: "2025→",
      short: "具身智能",
      role: "影响",
      title: "走向物理世界：空间与具身智能",
      detail:
        "李飞飞提出空间智能让 AI 理解三维物理规则；具身智能把 AI 装入机器人，特斯拉 Optimus 等竞争。AI 正从数字世界进入物理世界，挑战人类对智能的定义。",
    },
  ],
};

/* ---------- 03 对比类 · 全球最大的金库，居然在这~（小Lin说） ---------- */
const COMPARE_DATA: TemplateRenderData = {
  coreQuestion: "实体黄金和虚拟黄金作为投资方式有何不同？",
  dimensions: ["交易成本", "心理满足", "储存成本", "流动性", "净投资量"],
  rows: [
    {
      label: "实体黄金",
      cells: ["高（约 3% 以上）", "强（拿在手里更踏实）", "高（需保险柜等）", "较低", "高（约占净投资 2/3）"],
    },
    {
      label: "虚拟黄金",
      cells: ["低", "弱（没有实物感）", "低", "高", "较小（但交易量巨大）"],
    },
  ],
  verdictLead: "视频结论",
  verdict: "实体黄金更受看重实物持有感的私人投资者青睐；虚拟黄金交易与储存成本更低、流动性更高，适合不同需求。",
};

/* ---------- 04 数据类 · 别只看英伟达！（坤元财研） ---------- */
const DATA_DATA: TemplateRenderData = {
  coreQuestion: "AI 算力芯片竞争格局如何？",
  chartTitle: "AI 训练 GPU 市场份额",
  unit: "单位 % · 视频论述口径",
  bars: [
    { label: "英伟达", sub: "CUDA 生态 + 全栈迭代", value: "≥90", unit: "%", pct: 92, kind: "echo" },
    { label: "其余合计", sub: "AMD / 自研 ASIC", value: "<10", unit: "%", pct: 9, kind: "sub" },
  ],
  echo: echo(
    "fb8d7f75",
    "英伟达的芯片帝国是如何铸就的？",
    "基地边缘 BaseEdge",
    "互相印证",
    "CUDA 降低门槛但短期无收益，资本压力巨大——这根 90% 的柱子是熬出来的，不是天生的。",
    "短期无收益",
  ),
};

/* ---------- 05 条件推演类 · 无人生还：雷曼兄弟崩盘始末（曼萨财经） ---------- */
const SCENARIO_DATA: TemplateRenderData = {
  coreQuestion: "雷曼为何未获救，进而引爆危机？",
  condition: "政府 / 华尔街出手救援雷曼？",
  offState: "否（史实）",
  onState: "是（反事实）",
  premise: {
    deform: "none",
    tag: "前提 · 恒定",
    title: "6390 亿资产，40 倍杠杆",
    detail: "房贷资产暴跌、濒临爆仓。保尔森两难：救则招民意反对，不救则可能拖垮整个金融系统。",
    echo: echo(
      "dec4f0de",
      "全球资本信仰崩塌时刻，复盘金融史上最阴冷的“瑞郎之夜”",
      "Vincent hahaha",
      "互相印证",
      "「瑞郎之夜」瑞士央行取消下限后，400 倍杠杆瞬间爆仓——与雷曼 40 倍同题，印证高杠杆的脆弱。",
      "400 倍杠杆瞬间爆仓",
      "濒临爆仓",
    ),
  },
  off: [
    {
      deform: "none",
      tag: "转折 · 已发生",
      title: "三次自救全部失败",
      detail: "福尔德死守高价葬送 KDB 与美洲银行收购，英国监管最后一刻否决巴克莱交易。",
    },
    {
      deform: "none",
      tag: "结果 · 已发生",
      title: "9·15 申请破产",
      detail: "2008 年 9 月 15 日凌晨雷曼破产，全球股市暴跌，信用市场瞬间冻结。",
    },
    {
      deform: "none",
      tag: "连锁 · 已发生",
      title: "全球金融海啸，政府被迫花数万亿救市",
      detail: "失业率飙升，政府最终动用远超救助雷曼所需的资金收拾残局。",
    },
  ],
  on: [
    {
      deform: "shift",
      tag: "转变 · 内容改写",
      title: "逼华尔街自救 → 政府直接注资 / 接管",
      detail: "原本「不动政府资金、逼华尔街自救」的中间道路被替换为公共兜底，谈判不再是唯一出路。",
    },
    {
      deform: "broken",
      tag: "断裂 · 节点失效",
      title: "9·15 申请破产",
      detail: "有兜底方，破产节点在原位置断裂——雷曼未必在这一天倒下。",
    },
    {
      deform: "fork",
      tag: "分叉 · 推演",
      title: "或阻断连锁，但埋下「大而不倒」道德风险",
      detail: "新分支：系统性冲击可能被抑制，代价是道德风险与政治反弹。这是推演，不是预测。",
    },
  ],
};

const SAMPLES: Record<string, SampleReader> = {
  "791e6331": {
    coreQuestion: "为什么经济体从繁荣转向萧条？",
    echoCount: 3,
    nodes: ARGUMENT_NODES,
    dispatch: createArgumentDispatch({
      coreQuestion: "为什么经济体从繁荣转向萧条？",
      nodes: ARGUMENT_NODES.map((n) => ({
        id: n.id,
        anchorId: n.anchorId,
        concept: n.label,
        role: n.role,
        detail: n.detail,
        timestamp: n.timestampText,
      })),
      confidence: 0.9,
      reason: "phase1-sample-fixture",
    }),
  },
  "55e6378f": {
    coreQuestion: "AI 是如何从图灵测试发展到今天的？",
    echoCount: 2,
    dispatch: dispatch("history", HISTORY_DATA),
  },
  "19cc77c7": {
    coreQuestion: "实体黄金和虚拟黄金作为投资方式有何不同？",
    echoCount: 0,
    dispatch: dispatch("compare", COMPARE_DATA),
  },
  "51330f35": {
    coreQuestion: "AI 算力芯片竞争格局如何？",
    echoCount: 1,
    dispatch: dispatch("data", DATA_DATA),
  },
  "1138db7c": {
    coreQuestion: "雷曼为何未获救，进而引爆危机？",
    echoCount: 1,
    dispatch: dispatch("scenario", SCENARIO_DATA),
  },
};

export function getSampleReader(id: string): SampleReader | null {
  return SAMPLES[id] ?? null;
}

/** 示例入口（/samples）严格只列五种单视频模板；合集样例由页面单独提供。 */
export const SAMPLE_TEMPLATES: { id: string; template: AnalysisTemplate; label: string }[] = [
  { id: "791e6331", template: "argument", label: "论证类" },
  { id: "55e6378f", template: "history", label: "历史类" },
  { id: "19cc77c7", template: "compare", label: "对比类" },
  { id: "51330f35", template: "data", label: "数据类" },
  { id: "1138db7c", template: "scenario", label: "条件推演类" },
];
