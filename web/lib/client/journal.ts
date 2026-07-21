/* ================================================================
   我的岛屿 · 本机记录（docs/我的岛屿_功能设计.md §3.1/§3.2）
   无账号，个人状态只存本机 localStorage：想法 + 足迹两张表。
   与 lib/client/parsingTracker.ts 同一套读写模式（guard window、try/catch）。
   读取给 React 用 useSyncExternalStore（而非 effect 里 setState）：
   SSR/首次水合期间安全返回空表，不会闪一下又跳数字。
   ================================================================ */
import { useSyncExternalStore } from "react";

const THOUGHTS_KEY = "echoes:thoughts:v1";
const FOOTPRINTS_KEY = "echoes:footprints:v1";

/** 记下的一条想法：默认仅自己可见；published=true 表示同时发到了讨论空间。
    anchor 是记录时停留的锚点（脉络节点或一条回响），不带则是无锚点的泛想法。 */
export interface Thought {
  id: string;
  createdAt: number;
  videoId: string;
  videoTitle: string;
  categoryId: string;
  href: string;
  body: string;
  anchor?: { kind: "node" | "echo"; label: string; text: string };
  published: boolean;
}

/** 一条足迹：看过/解析过某个视频。留没留过想法不单独存——
    /me/footprints 读取时用 videoId 对 listThoughts() 求一次交集即可，避免两张表失步。 */
export interface Footprint {
  videoId: string;
  videoTitle: string;
  categoryId: string;
  collectionId?: string;
  collectionTitle?: string;
  firstSeenAt: number;
  lastSeenAt: number;
}

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, rows: T[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    /* 隐私模式等场景存储不可用，本机记录静默失效，不影响主流程 */
  }
  notify();
}

export function listThoughts(): Thought[] {
  return read<Thought>(THOUGHTS_KEY).sort((a, b) => b.createdAt - a.createdAt);
}

export function addThought(input: Omit<Thought, "id" | "createdAt">): Thought {
  const thought: Thought = {
    ...input,
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  write(THOUGHTS_KEY, [...read<Thought>(THOUGHTS_KEY), thought]);
  return thought;
}

/** 讨论区发帖成功后回填——记想法时本地先落盘，发布是之后才知道结果的一步。 */
export function markThoughtPublished(id: string) {
  const rows = read<Thought>(THOUGHTS_KEY);
  write(
    THOUGHTS_KEY,
    rows.map((t) => (t.id === id ? { ...t, published: true } : t)),
  );
}

export function listFootprints(): Footprint[] {
  return read<Footprint>(FOOTPRINTS_KEY).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

/** 进入一个视频解析页即留痕：已有记录只刷新 lastSeenAt，不重复计数。 */
export function recordFootprint(input: Omit<Footprint, "firstSeenAt" | "lastSeenAt">) {
  const rows = read<Footprint>(FOOTPRINTS_KEY);
  const now = Date.now();
  const existing = rows.find((f) => f.videoId === input.videoId);
  if (existing) {
    write(
      FOOTPRINTS_KEY,
      rows.map((f) => (f.videoId === input.videoId ? { ...f, ...input, lastSeenAt: now } : f))
    );
    return;
  }
  write(FOOTPRINTS_KEY, [...rows, { ...input, firstSeenAt: now, lastSeenAt: now }]);
}

/** §5 页面顶部的两个累计数字。 */
export function journalCounts(): { islands: number; thoughts: number } {
  return { islands: listFootprints().length, thoughts: listThoughts().length };
}

const DEMO_SEEDED_KEY = "echoes:journal-demo-seeded:v1";

/** 首次打开补一批示例内容，避免刚接入我的岛屿时想法岛/足迹岛是空的（评审现场没有真实历史积累）。
    只在本机完全没有记录时播种一次，写标记后不会再自动播种——用户清空想法/足迹后也不会被复活。
    发布过的两条对应真实写进了讨论区的帖子（video.3a7ca86a / video.316a1ad1），「去讨论区看看」有内容可看。 */
export function ensureDemoJournalSeed() {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(DEMO_SEEDED_KEY)) return;
    window.localStorage.setItem(DEMO_SEEDED_KEY, "1");
    if (read<Thought>(THOUGHTS_KEY).length > 0 || read<Footprint>(FOOTPRINTS_KEY).length > 0) return;
  } catch {
    return;
  }

  const hoursAgo = (h: number) => Date.now() - h * 3.6e6;
  const demoThoughts: Thought[] = [
    {
      id: "demo-t1",
      createdAt: hoursAgo(3),
      videoId: "3a7ca86a",
      videoTitle: "5个经济学冷知识：一瓶牛奶可乐带你看懂世界运转逻辑",
      categoryId: "eco",
      href: "/video/3a7ca86a",
      body: "一瓶牛奶的定价里，藏着好几层博弈，比想象中复杂。",
      published: true,
    },
    {
      id: "demo-t2",
      createdAt: hoursAgo(20),
      videoId: "316a1ad1",
      videoTitle: "两晋02：胡人蛮夷用了五百年，包围了晋朝",
      categoryId: "his",
      href: "/video/316a1ad1",
      body: "“五百年边疆压力”这个说法，比“五胡乱华”这个标签更站得住脚。",
      published: true,
    },
    {
      id: "demo-t3",
      createdAt: hoursAgo(30),
      videoId: "55e6378f",
      videoTitle: "AI简史：从1950到2026，科学界的人类群星闪耀时",
      categoryId: "tech",
      href: "/video/55e6378f",
      body: "AI 的几次“寒冬”，好像每次都是被同一类瓶颈卡住的。",
      published: false,
    },
  ];
  const demoFootprints: Footprint[] = [
    { videoId: "3a7ca86a", videoTitle: "5个经济学冷知识：一瓶牛奶可乐带你看懂世界运转逻辑", categoryId: "eco", collectionId: "misc-eco", collectionTitle: "经济 · 散篇集", firstSeenAt: hoursAgo(3), lastSeenAt: hoursAgo(3) },
    { videoId: "316a1ad1", videoTitle: "两晋02：胡人蛮夷用了五百年，包围了晋朝", categoryId: "his", collectionId: "832cf0f1", collectionTitle: "两晋沉沦", firstSeenAt: hoursAgo(20), lastSeenAt: hoursAgo(20) },
    { videoId: "55e6378f", videoTitle: "AI简史：从1950到2026，科学界的人类群星闪耀时", categoryId: "tech", collectionId: "misc-tech", collectionTitle: "科技 · 散篇集", firstSeenAt: hoursAgo(30), lastSeenAt: hoursAgo(30) },
    { videoId: "1138db7c", videoTitle: "无人生还：万字解析雷曼兄弟崩盘始末", categoryId: "eco", collectionId: "tc-25dff437", collectionTitle: "金融泡沫与崩盘", firstSeenAt: hoursAgo(50), lastSeenAt: hoursAgo(50) },
    { videoId: "dec4f0de", videoTitle: "全球资本信仰崩塌时刻，复盘金融史上最阴冷的“瑞郎之夜”", categoryId: "eco", collectionId: "tc-25dff437", collectionTitle: "金融泡沫与崩盘", firstSeenAt: hoursAgo(75), lastSeenAt: hoursAgo(75) },
    { videoId: "51330f35", videoTitle: "别只看英伟达！", categoryId: "tech", collectionId: "tc-305aa55b", collectionTitle: "AI算力竞争与瓶颈", firstSeenAt: hoursAgo(100), lastSeenAt: hoursAgo(100) },
    { videoId: "ee255491", videoTitle: "SpaceX上市，背后在玩什么资本游戏?", categoryId: "eco", collectionId: "misc-eco", collectionTitle: "经济 · 散篇集", firstSeenAt: hoursAgo(130), lastSeenAt: hoursAgo(130) },
  ];

  write(THOUGHTS_KEY, demoThoughts);
  write(FOOTPRINTS_KEY, demoFootprints);
}

/* ---------- React 读取：useSyncExternalStore，不在 effect 里 setState ---------- */

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY: never[] = [];
const getServerSnapshot = () => EMPTY;

/** raw 字符串没变就复用上一次的数组引用——否则 useSyncExternalStore 会把
    "每次都是新数组" 误判成"外部状态一直在变"，陷入重渲染死循环。 */
function cachedSnapshot<T>(key: string, sort: (rows: T[]) => T[]) {
  let rawCache: string | null | undefined;
  let valueCache: T[] = EMPTY;
  return (): T[] => {
    if (typeof window === "undefined") return EMPTY;
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      return valueCache;
    }
    if (raw !== rawCache) {
      rawCache = raw;
      try {
        valueCache = sort(raw ? (JSON.parse(raw) as T[]) : []);
      } catch {
        valueCache = EMPTY;
      }
    }
    return valueCache;
  };
}

const getThoughtsSnapshot = cachedSnapshot<Thought>(THOUGHTS_KEY, (rows) =>
  [...rows].sort((a, b) => b.createdAt - a.createdAt)
);
const getFootprintsSnapshot = cachedSnapshot<Footprint>(FOOTPRINTS_KEY, (rows) =>
  [...rows].sort((a, b) => b.lastSeenAt - a.lastSeenAt)
);

export function useThoughts(): Thought[] {
  return useSyncExternalStore(subscribe, getThoughtsSnapshot, getServerSnapshot);
}

export function useFootprints(): Footprint[] {
  return useSyncExternalStore(subscribe, getFootprintsSnapshot, getServerSnapshot);
}

export function useJournalCounts(): { islands: number; thoughts: number } {
  return { islands: useFootprints().length, thoughts: useThoughts().length };
}
