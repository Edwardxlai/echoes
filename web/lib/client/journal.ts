/* ================================================================
   我的岛屿 · 独立用户记录层

   AI 生成结果不写入这里；本模块只维护用户想法、探索足迹和当前锚点清单。
   v2 会无损读取并迁移 v1 的想法/足迹，旧记录永不因生成内容更新而删除。
   ================================================================ */
import { useSyncExternalStore } from "react";

const THOUGHTS_KEY = "echoes:thoughts:v2";
const FOOTPRINTS_KEY = "echoes:footprints:v2";
const MANIFESTS_KEY = "echoes:anchor-manifests:v1";
const LEGACY_THOUGHTS_KEY = "echoes:thoughts:v1";
const LEGACY_FOOTPRINTS_KEY = "echoes:footprints:v1";

export interface ThoughtAnchorSnapshot {
  /** 旧 v1 记录可能没有 anchorId；它仍保留快照，并按游离记录处理。 */
  anchorId?: string;
  kind: "node" | "echo";
  label: string;
  text: string;
}

export interface Thought {
  id: string;
  createdAt: number;
  /** 合集页「整组理解」不挂具体某一集，videoId 缺席；用 collectionId 代替。 */
  videoId?: string;
  videoTitle: string;
  categoryId: string;
  href: string;
  body: string;
  anchor?: ThoughtAnchorSnapshot;
  /** 合集级想法（CollectionThoughts）专属；单视频想法（ThoughtBar）不写这个字段。 */
  collectionId?: string;
}

export interface Footprint {
  videoId: string;
  videoTitle: string;
  categoryId: string;
  collectionId?: string;
  collectionTitle?: string;
  firstSeenAt: number;
  lastSeenAt: number;
  exploredAnchorIds: string[];
  viewedEchoAnchorIds: string[];
}

export interface AnchorManifestItem {
  anchorId: string;
  kind: "node" | "echo";
  label: string;
  text: string;
}

export interface AnchorManifest {
  videoId: string;
  videoTitle: string;
  href: string;
  updatedAt: number;
  anchors: AnchorManifestItem[];
}

export type ThoughtAttachment = "video" | "attached" | "pending" | "orphan";

/** ThoughtBar / CollectionThoughts 共用的紧凑时间戳（M-D HH:MM），想法岛用的是相对时间，不走这个。 */
export function formatThoughtTimestamp(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}-${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function readRows<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function ensureV2Migration() {
  if (typeof window === "undefined") return;
  try {
    if (!window.localStorage.getItem(THOUGHTS_KEY)) {
      const legacy = readRows<Thought>(LEGACY_THOUGHTS_KEY);
      if (legacy.length) window.localStorage.setItem(THOUGHTS_KEY, JSON.stringify(legacy));
    }
    if (!window.localStorage.getItem(FOOTPRINTS_KEY)) {
      const legacy = readRows<Footprint>(LEGACY_FOOTPRINTS_KEY).map((row) => ({
        ...row,
        exploredAnchorIds: row.exploredAnchorIds ?? [],
        viewedEchoAnchorIds: row.viewedEchoAnchorIds ?? [],
      }));
      if (legacy.length) window.localStorage.setItem(FOOTPRINTS_KEY, JSON.stringify(legacy));
    }
  } catch {
    /* 隐私模式下保持主流程可用。 */
  }
}

function writeRows<T>(key: string, rows: T[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    /* 本机存储不可用时静默失效，不阻塞阅读。 */
  }
  notify();
}

export function listThoughts(): Thought[] {
  ensureV2Migration();
  return readRows<Thought>(THOUGHTS_KEY).sort((a, b) => b.createdAt - a.createdAt);
}

export function addThought(input: Omit<Thought, "id" | "createdAt">): Thought {
  ensureV2Migration();
  const thought: Thought = {
    ...input,
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  writeRows(THOUGHTS_KEY, [...readRows<Thought>(THOUGHTS_KEY), thought]);
  return thought;
}

export function listFootprints(): Footprint[] {
  ensureV2Migration();
  return readRows<Footprint>(FOOTPRINTS_KEY).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

/** 进入解析页即留痕；节点与回响探索在同一视频足迹上做集合并集。 */
export function recordFootprint(
  input: Omit<Footprint, "firstSeenAt" | "lastSeenAt" | "exploredAnchorIds" | "viewedEchoAnchorIds"> & {
    exploredAnchorIds?: string[];
    viewedEchoAnchorIds?: string[];
  },
) {
  ensureV2Migration();
  const rows = readRows<Footprint>(FOOTPRINTS_KEY);
  const timestamp = Date.now();
  const existing = rows.find((row) => row.videoId === input.videoId);
  if (existing) {
    writeRows(
      FOOTPRINTS_KEY,
      rows.map((row) =>
        row.videoId === input.videoId
          ? {
              ...row,
              ...input,
              exploredAnchorIds: [...new Set([...(row.exploredAnchorIds ?? []), ...(input.exploredAnchorIds ?? [])])],
              viewedEchoAnchorIds: [...new Set([...(row.viewedEchoAnchorIds ?? []), ...(input.viewedEchoAnchorIds ?? [])])],
              lastSeenAt: timestamp,
            }
          : row,
      ),
    );
    return;
  }
  writeRows(FOOTPRINTS_KEY, [
    ...rows,
    {
      ...input,
      exploredAnchorIds: input.exploredAnchorIds ?? [],
      viewedEchoAnchorIds: input.viewedEchoAnchorIds ?? [],
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
    },
  ]);
}

export function registerAnchorManifest(input: Omit<AnchorManifest, "updatedAt">) {
  const rows = readRows<AnchorManifest>(MANIFESTS_KEY);
  const manifest: AnchorManifest = { ...input, updatedAt: Date.now() };
  writeRows(MANIFESTS_KEY, [
    ...rows.filter((row) => row.videoId !== input.videoId),
    manifest,
  ]);
}

export function listAnchorManifests(): AnchorManifest[] {
  return readRows<AnchorManifest>(MANIFESTS_KEY);
}

/**
 * pending 表示还没在本机见过该视频的最新锚点清单，不能贸然判成游离；
 * orphan 只在已经拿到最新清单且确实匹配失败时出现。
 */
export function thoughtAttachment(
  thought: Thought,
  manifests: readonly AnchorManifest[],
): ThoughtAttachment {
  if (!thought.anchor) return "video";
  const manifest = manifests.find((item) => item.videoId === thought.videoId);
  if (!manifest) return "pending";
  if (!thought.anchor.anchorId) return "orphan";
  return manifest.anchors.some((anchor) => anchor.anchorId === thought.anchor?.anchorId)
    ? "attached"
    : "orphan";
}

export function journalCounts(): { islands: number; thoughts: number } {
  return { islands: listFootprints().length, thoughts: listThoughts().length };
}

const DEMO_SEEDED_KEY = "echoes:journal-demo-seeded:v2";
const LEGACY_DEMO_SEEDED_KEY = "echoes:journal-demo-seeded:v1";

/** 首次打开时补演示数据；真实 v1/v2 记录任一存在都不会被覆盖。 */
export function ensureDemoJournalSeed() {
  if (typeof window === "undefined") return;
  ensureV2Migration();
  try {
    if (window.localStorage.getItem(DEMO_SEEDED_KEY)) return;
    if (window.localStorage.getItem(LEGACY_DEMO_SEEDED_KEY)) {
      window.localStorage.setItem(DEMO_SEEDED_KEY, "1");
      return;
    }
    window.localStorage.setItem(DEMO_SEEDED_KEY, "1");
    if (readRows<Thought>(THOUGHTS_KEY).length || readRows<Footprint>(FOOTPRINTS_KEY).length) return;
  } catch {
    return;
  }

  const hoursAgo = (hours: number) => Date.now() - hours * 3.6e6;
  const thoughts: Thought[] = [
    { id: "demo-t1", createdAt: hoursAgo(3), videoId: "3a7ca86a", videoTitle: "5个经济学冷知识：一瓶牛奶可乐带你看懂世界运转逻辑", categoryId: "eco", href: "/video/3a7ca86a", body: "一瓶牛奶的定价里，藏着好几层博弈，比想象中复杂。" },
    { id: "demo-t2", createdAt: hoursAgo(20), videoId: "316a1ad1", videoTitle: "两晋02：胡人蛮夷用了五百年，包围了晋朝", categoryId: "his", href: "/video/316a1ad1", body: "“五百年边疆压力”这个说法，比“五胡乱华”这个标签更站得住脚。" },
    { id: "demo-t3", createdAt: hoursAgo(30), videoId: "55e6378f", videoTitle: "AI简史：从1950到2026，科学界的人类群星闪耀时", categoryId: "tech", href: "/video/55e6378f", body: "AI 的几次“寒冬”，好像每次都是被同一类瓶颈卡住的。" },
  ];
  const footprints: Footprint[] = [
    { videoId: "3a7ca86a", videoTitle: "5个经济学冷知识：一瓶牛奶可乐带你看懂世界运转逻辑", categoryId: "eco", collectionId: "misc-eco", collectionTitle: "经济 · 散篇集", firstSeenAt: hoursAgo(3), lastSeenAt: hoursAgo(3), exploredAnchorIds: [], viewedEchoAnchorIds: [] },
    { videoId: "316a1ad1", videoTitle: "两晋02：胡人蛮夷用了五百年，包围了晋朝", categoryId: "his", collectionId: "832cf0f1", collectionTitle: "两晋沉沦", firstSeenAt: hoursAgo(20), lastSeenAt: hoursAgo(20), exploredAnchorIds: [], viewedEchoAnchorIds: [] },
    { videoId: "55e6378f", videoTitle: "AI简史：从1950到2026，科学界的人类群星闪耀时", categoryId: "tech", collectionId: "misc-tech", collectionTitle: "科技 · 散篇集", firstSeenAt: hoursAgo(30), lastSeenAt: hoursAgo(30), exploredAnchorIds: [], viewedEchoAnchorIds: [] },
    { videoId: "1138db7c", videoTitle: "无人生还：万字解析雷曼兄弟崩盘始末", categoryId: "eco", collectionId: "tc-25dff437", collectionTitle: "金融泡沫与崩盘", firstSeenAt: hoursAgo(50), lastSeenAt: hoursAgo(50), exploredAnchorIds: [], viewedEchoAnchorIds: [] },
    { videoId: "dec4f0de", videoTitle: "全球资本信仰崩塌时刻，复盘金融史上最阴冷的“瑞郎之夜”", categoryId: "eco", collectionId: "tc-25dff437", collectionTitle: "金融泡沫与崩盘", firstSeenAt: hoursAgo(75), lastSeenAt: hoursAgo(75), exploredAnchorIds: [], viewedEchoAnchorIds: [] },
    { videoId: "51330f35", videoTitle: "别只看英伟达！", categoryId: "tech", collectionId: "tc-305aa55b", collectionTitle: "AI算力竞争与瓶颈", firstSeenAt: hoursAgo(100), lastSeenAt: hoursAgo(100), exploredAnchorIds: [], viewedEchoAnchorIds: [] },
    { videoId: "ee255491", videoTitle: "SpaceX上市，背后在玩什么资本游戏?", categoryId: "eco", collectionId: "misc-eco", collectionTitle: "经济 · 散篇集", firstSeenAt: hoursAgo(130), lastSeenAt: hoursAgo(130), exploredAnchorIds: [], viewedEchoAnchorIds: [] },
  ];
  writeRows(THOUGHTS_KEY, thoughts);
  writeRows(FOOTPRINTS_KEY, footprints);
}

const SAMPLE_THOUGHTS_SEEDED_KEY = "echoes:sample-thoughts-seeded:v1";

/** /samples 演示用：五个单视频模板样例各补一条想法，合集 c1 补两集 + 一条整组想法，
   方便直接在 /video、/collection 页面看「想法」区块和想法岛的效果。
   独立于 ensureDemoJournalSeed 的"仅首次且本机无想法时"闸门——不管本机是否已有真实想法都补一次，
   按 id 幂等，重复调用不会重复插入。 */
export function ensureSampleThoughtsSeed() {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(SAMPLE_THOUGHTS_SEEDED_KEY)) return;
    window.localStorage.setItem(SAMPLE_THOUGHTS_SEEDED_KEY, "1");
  } catch {
    return;
  }

  const hoursAgo = (hours: number) => Date.now() - hours * 3.6e6;
  const thoughts: Thought[] = [
    { id: "sample-t1", createdAt: hoursAgo(2), videoId: "791e6331", videoTitle: "欧文·费雪《繁荣与萧条》精读", categoryId: "eco", href: "/video/791e6331", body: "「九连环」这个比喻比教科书上的传导链条直观太多，一环松了后面全塌。" },
    { id: "sample-t2", createdAt: hoursAgo(5), videoId: "d085ddb7", videoTitle: "主线分歧：左侧博弈穿越有何风险？", categoryId: "eco", href: "/video/d085ddb7", body: "右侧分离信号听着简单，真到分歧那两天大概率还是忍不住抢跑。" },
    { id: "sample-t3", createdAt: hoursAgo(8), videoId: "51330f35", videoTitle: "别只看英伟达！", categoryId: "tech", href: "/video/51330f35", body: "90% 的份额是熬出来的这句话，比单纯说「垄断」更值得记住。" },
    { id: "sample-t4", createdAt: hoursAgo(12), videoId: "1138db7c", videoTitle: "无人生还：万字解析雷曼兄弟崩盘始末", categoryId: "eco", href: "/video/1138db7c", body: "如果政府当时兜底了，道德风险这笔账不知道现在该谁来还。" },
  ];
  const existing = readRows<Thought>(THOUGHTS_KEY);
  const existingIds = new Set(existing.map((t) => t.id));
  writeRows(THOUGHTS_KEY, [...existing, ...thoughts.filter((t) => !existingIds.has(t.id))]);
}

const listeners = new Set<() => void>();
function notify() { listeners.forEach((listener) => listener()); }
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY: never[] = [];
const getServerSnapshot = () => EMPTY;

function cachedSnapshot<T>(key: string, sort: (rows: T[]) => T[]) {
  let rawCache: string | null | undefined;
  let valueCache: T[] = EMPTY;
  return (): T[] => {
    if (typeof window === "undefined") return EMPTY;
    ensureV2Migration();
    let raw: string | null;
    try { raw = window.localStorage.getItem(key); }
    catch { return valueCache; }
    if (raw !== rawCache) {
      rawCache = raw;
      try { valueCache = sort(raw ? (JSON.parse(raw) as T[]) : []); }
      catch { valueCache = EMPTY; }
    }
    return valueCache;
  };
}

const getThoughtsSnapshot = cachedSnapshot<Thought>(THOUGHTS_KEY, (rows) => [...rows].sort((a, b) => b.createdAt - a.createdAt));
const getFootprintsSnapshot = cachedSnapshot<Footprint>(FOOTPRINTS_KEY, (rows) => [...rows].sort((a, b) => b.lastSeenAt - a.lastSeenAt));
const getManifestsSnapshot = cachedSnapshot<AnchorManifest>(MANIFESTS_KEY, (rows) => rows);

export function useThoughts(): Thought[] {
  return useSyncExternalStore(subscribe, getThoughtsSnapshot, getServerSnapshot);
}
export function useFootprints(): Footprint[] {
  return useSyncExternalStore(subscribe, getFootprintsSnapshot, getServerSnapshot);
}
export function useAnchorManifests(): AnchorManifest[] {
  return useSyncExternalStore(subscribe, getManifestsSnapshot, getServerSnapshot);
}
export function useJournalCounts(): { islands: number; thoughts: number } {
  return { islands: useFootprints().length, thoughts: useThoughts().length };
}
