/* ================================================================
   回响 · 数据类型定义 + 区域大类元数据（PRD V1.2 §8 数据模型）
   演示种子视频/合集已下线，真实内容一律走 store / real-data；
   这里只保留类型与六大类的结构性元数据（区域名与地图锚点）。
   ================================================================ */

export type VideoType = "argument" | "narrative" | "intro" | "compare" | "concept";

export const VIDEO_TYPE_LABEL: Record<VideoType, string> = {
  argument: "论证类",
  narrative: "叙事类",
  intro: "介绍类",
  compare: "对比类",
  concept: "概念类",
};

export interface Echo {
  /** 当前内容锚点 ↔ 目标内容锚点；旧 seed 可缺席，存量迁移会回填。 */
  sourceAnchorId?: string;
  targetAnchorId?: string;
  targetTitle: string;
  targetVideoId?: string; // 有则可跳转；无则只做溯源展示，不裸跳
  creator: string;
  timestampText: string;
  relation: string; // 关系定性短标签（"唱反调"），不带"你看过的"前后缀
  oldSay?: string; // 方案 D：旧方一句，对着节点叙述写成"接话"；新方=节点 detail 本身，不复述
  oldFocus?: string; // oldSay 里的分歧焦点（子串），划暖金荧光
  nodeFocus?: string; // 节点 detail 里的对应原文短语（子串），划暖金荧光
  sentence?: string; // 旧格式的一句话展开（演示数据兜底，与 oldSay 互斥）
}

export interface Node {
  id: string;
  anchorId: string;
  label: string;
  /** 节点在骨架中的环节名（"核心张力"/"论据"），左轨优先显示；缺席回落 timestampText。 */
  role?: string;
  timestampText: string;
  detail: string;
  echo?: Echo;
}

export interface CognitiveExpansion {
  gapFill: {
    gap?: string; // 补缺·戳破：视频承重却没铺的地基（门控：无则不渲染补缺块）
    fill?: string; // 补缺·补上：视频外的背景知识，与 gap 连读成一段；有 gap 必有 fill
    focus?: string; // fill 里要划琥珀高亮的关键子串（须原样出现在 fill 中）
    searchTerms?: string[]; // 补缺·去搜：2~3 个可直接拿去抖音搜的关键词，引导用户自己往下补
  };
}

/** 合集级补缺（往旁看）：整组共同绕开的相邻维度。与单视频补缺不同，也不重复各视频已补的内容。 */
export interface CollectionGapFill {
  gap: string;
  fill: string;
  focus?: string; // fill 里要划琥珀高亮的关键子串
  searchTerms?: string[]; // 2~3 个可直接拿去抖音搜的关键词
}

/** Map-relevant business truth. Presentation details stay in map-config.ts. */
export interface VideoMapState {
  viewed: boolean;
  isNew: boolean;
  contentRich: boolean;
}

export interface Video extends VideoMapState {
  id: string;
  title: string;
  creator: string;
  duration: string;
  collectionId: string;
  /** 必填（V1.2 变更摘要 #14，群岛信息面板必显）。正式数据复用抖音封面，demo seed 用占位图。 */
  cover: string;
  /** 平台原视频链接（沿用 source_assets.sourceUrl）。缺失=上传文件兜底录入，群岛信息面板"查看原视频"入口整体隐藏。 */
  sourceUrl?: string;
  coreQuestion: string;
  videoType: VideoType;
  typeConfidence: number;
  nodes: Node[];
  cognitiveExpansion: CognitiveExpansion;
  mapItemId: string;
}

/** 知识点里的一个要点：脉络式左锚点 + 右解释。focus 划琥珀高亮，ref 是溯源序号（1-based）做上角标。 */
export interface SynthesisFacet {
  lead: string; // 左轨档位标签（该 relation 的固定档位），≤4字
  label: string; // 概念标题（收起时显示），≤14字
  detail: string; // 展开正文，2~4句
  focus?: string; // detail 里要高亮的子串（须原样出现在 detail 中）
  ref?: number; // 上角标数字 = 对应 sources 的序号（1-based）
  refs?: number[]; // 多条视频共同支撑该要点时的来源序号（1-based）
  text?: string; // 兼容旧数据：重生成前的一句话 facet
}

export interface SynthesisPoint {
  label: string;
  relation: string; // "立场分布/补充印证/对撞/衔接"，AI 一句话生成，不做枚举硬分类
  stance?: { tag: "a" | "b" | "c"; text: string }[]; // 争议型可选：立场统计
  facets?: SynthesisFacet[]; // 结构化要点（新）；有它就走脉络式渲染
  note?: string; // 兜底：老数据/未重生成时的一整段话
  sources: { videoId: string; title: string; timestampText: string }[];
  echo?: Echo;
}

export interface Synthesis {
  seriesQuestion: string;
  /** 每集在合集语境下的 AI 语义短签，供分享卡等紧凑视图使用。 */
  episodeLabels?: { videoId: string; label: string }[];
  points: SynthesisPoint[];
}

export interface Collection {
  id: string;
  name: string;
  categoryId: string;
  videoIds: string[];
  echoCount: number;
  terrain: string; // 地貌隐喻标签，§5.2.2（"不要求一一写实对应"）
  glyphKind: "city" | "tower" | "ruins" | "port"; // 区域地图页地标图形
  synthesis?: Synthesis;
  cognitiveExpansion?: CognitiveExpansion; // scope=整组，§6.3"作用范围随查看层级变化"
  mapItemId: string;
}

export interface Category {
  id: string;
  name: string;
  collectionIds: string[];
  echoCount: number;
  mapItemId: string;
}

export const VIDEOS: Record<string, Video> = {};

export const COLLECTIONS: Record<string, Collection> = {};

export const CATEGORIES: Record<string, Category> = {
  eco: { id: "eco", name: "经济", collectionIds: [], echoCount: 0, mapItemId: "region-eco" },
  his: { id: "his", name: "历史", collectionIds: [], echoCount: 0, mapItemId: "region-his" },
  tech: { id: "tech", name: "科技", collectionIds: [], echoCount: 0, mapItemId: "region-tech" },
  soc: { id: "soc", name: "社会思想", collectionIds: [], echoCount: 0, mapItemId: "region-soc" },
  sci: { id: "sci", name: "自然科学", collectionIds: [], echoCount: 0, mapItemId: "region-sci" },
  life: { id: "life", name: "日常", collectionIds: [], echoCount: 0, mapItemId: "region-life" },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);

export function getVideo(id: string) {
  return VIDEOS[id];
}
export function getCollection(id: string) {
  return COLLECTIONS[id];
}
export function getCategory(id: string) {
  return CATEGORIES[id];
}
export function videosOf(collectionId: string) {
  return COLLECTIONS[collectionId]?.videoIds.map((id) => VIDEOS[id]) ?? [];
}
export function collectionsOf(categoryId: string) {
  return CATEGORIES[categoryId]?.collectionIds.map((id) => COLLECTIONS[id]) ?? [];
}
