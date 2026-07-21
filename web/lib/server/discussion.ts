/* ================================================================
   回响 · 讨论空间服务端逻辑（讨论区收拢版，2026-07-20 定稿；发言门槛已删除 2026-07-21）
   一视频/一合集只有一个讨论空间（topicId = video.{id} / collection.{id}）：
   - 延伸降格为官方置顶提问帖（每空间固定前 2 条），回复即答题
   - 回响独立题线取消，quoteRef 可引一条回响（关系词+旧方一句）
   - 发言不设门槛（黑客松现场数据积累不起来，门槛感受不到，只留 seen 背书）
   旧线编码（extend.{owner}.{idx} / echo.{videoId}.{nodeId}）的种子与真实帖
   在读取层迁移合并进空间视图，路由经 legacyTopicRedirect 重定向。
   数据源两层与全站一致：种子（lib/data.ts）优先，miss 查真实解析（store）。
   ================================================================ */
import type { Echo, Video } from "@/lib/data";
import { COLLECTIONS, VIDEOS } from "@/lib/data";
import { SEED_POSTS, SEED_SEEN, type PostView, type SeedPost } from "@/lib/discussion";
import {
  countAnalyzedByCategory,
  getAsset,
  getCollectionExtend,
  getCollectionRow,
  getParsedVideo,
  hasRealMapContent,
  listAssetsByCollection,
  listTopicPostsByOwner,
  type TopicPostRow,
} from "./store";

/** 延伸固定 2 个置顶帖（2026-07-20 定稿）；存量第 3 条的旧帖降为带引的普通帖。 */
export const PINNED_MAX = 2;

/** "你"在该大类下的阅读足迹（seen 背书用，纯展示，不拦发言）；
    跟随地图的数据源开关：有真实内容按真实解析数算，否则按种子观看史算。 */
export function categorySeenCount(categoryId: string): number {
  return hasRealMapContent()
    ? countAnalyzedByCategory(categoryId)
    : Object.values(VIDEOS).filter(
        (v) => v.viewed && COLLECTIONS[v.collectionId]?.categoryId === categoryId
      ).length;
}

type OwnerVideo = Video | NonNullable<ReturnType<typeof getParsedVideo>>;

const findVideo = (id: string): OwnerVideo | null =>
  VIDEOS[id] ?? getParsedVideo(id) ?? null;

const videoCategoryId = (id: string): string =>
  VIDEOS[id]
    ? COLLECTIONS[VIDEOS[id].collectionId]?.categoryId ?? ""
    : getAsset(id)?.bigCategoryId ?? "";

export interface Topic {
  kind: "video" | "collection";
  ownerId: string;
  ownerTitle: string;
  backHref: string;
  categoryId: string;
}

export function resolveTopic(topicId: string): Topic | null {
  const dot = topicId.indexOf(".");
  if (dot < 0) return null;
  const kind = topicId.slice(0, dot);
  const ownerId = topicId.slice(dot + 1);
  if (!ownerId) return null;

  if (kind === "video") {
    const video = findVideo(ownerId);
    if (!video) return null;
    return {
      kind: "video",
      ownerId,
      ownerTitle: video.title,
      backHref: `/video/${ownerId}`,
      categoryId: videoCategoryId(ownerId),
    };
  }
  if (kind === "collection") {
    const seed = COLLECTIONS[ownerId];
    if (seed) {
      return {
        kind: "collection",
        ownerId,
        ownerTitle: seed.name,
        backHref: `/collection/${ownerId}/synthesis`,
        categoryId: seed.categoryId,
      };
    }
    const real = getCollectionRow(ownerId);
    if (real) {
      return {
        kind: "collection",
        ownerId,
        ownerTitle: real.name,
        backHref: `/collection/${ownerId}/synthesis`,
        categoryId: real.categoryId,
      };
    }
  }
  return null;
}

/** 旧线编码 → 新空间地址（带入口锚点参数）；不是旧编码或找不到主人则返回 null。
    extend 线落到对应置顶帖（前 2 条），echo 线落到自动引用该回响的 composer。 */
export function legacyTopicRedirect(topicId: string): string | null {
  const [kind, ownerId, ...rest] = topicId.split(".");
  if (!ownerId || !rest.length) return null;

  if (kind === "extend") {
    const base = findVideo(ownerId)
      ? `video.${ownerId}`
      : COLLECTIONS[ownerId] ?? getCollectionRow(ownerId)
        ? `collection.${ownerId}`
        : null;
    if (!base) return null;
    const idx = Number(rest.join("."));
    return Number.isInteger(idx) && idx >= 0 && idx < PINNED_MAX
      ? `/topic/${base}?reply=pin-${idx}`
      : `/topic/${base}`;
  }
  if (kind === "echo") {
    if (!findVideo(ownerId)) return null;
    return `/topic/video.${ownerId}?quote=${encodeURIComponent(`echo:${rest.join(".")}`)}`;
  }
  return null;
}

/* ---------- quoteRef 可引池 ---------- */

export interface QuoteItem {
  /** 可引池内唯一 key：脉络句=节点 id（合集空间加 `{videoId}:` 前缀防撞车）；
      回响=`echo:{nodeId}`（回响只在单视频空间可引）。 */
  nodeId: string;
  videoId: string;
  videoTitle: string;
  label: string;
  text: string;
  kind: "node" | "echo";
}

const echoQuoteText = (echo: Echo): string =>
  echo.oldSay || echo.sentence || echo.targetTitle;

const echoRelationLabel = (echo: Echo): string =>
  echo.relation.includes("《")
    ? echo.relation
    : `《${echo.targetTitle}》${echo.relation}`;

/** quoteRef 的可引池：空间所属视频的脉络节点 + 挂在节点上的回响。
    合集空间没有自己的脉络（PRD 否决系列脉络），池聚合所有成员视频的节点，
    composer 先选集再选句（2026-07-19 用户定稿）；回响项只进单视频空间的池。 */
export function topicQuotePool(topicId: string): QuoteItem[] {
  const topic = resolveTopic(topicId);
  if (!topic) return [];

  if (topic.kind === "video") {
    const video = findVideo(topic.ownerId);
    if (!video) return [];
    return [
      ...video.nodes.map((n) => ({
        nodeId: n.id,
        videoId: topic.ownerId,
        videoTitle: video.title,
        label: n.label,
        text: n.detail,
        kind: "node" as const,
      })),
      ...video.nodes
        .filter((n) => n.echo)
        .map((n) => ({
          nodeId: `echo:${n.id}`,
          videoId: topic.ownerId,
          videoTitle: video.title,
          label: "✦ 回响",
          text: echoQuoteText(n.echo!),
          kind: "echo" as const,
        })),
    ];
  }
  const memberVideos: OwnerVideo[] = COLLECTIONS[topic.ownerId]
    ? COLLECTIONS[topic.ownerId].videoIds
        .map((id) => VIDEOS[id])
        .filter((v): v is Video => !!v)
    : listAssetsByCollection(topic.ownerId)
        .map((a) => getParsedVideo(a.id))
        .filter((v): v is NonNullable<ReturnType<typeof getParsedVideo>> => !!v);
  return memberVideos.flatMap((v) =>
    v.nodes.map((n) => ({
      nodeId: `${v.id}:${n.id}`,
      videoId: v.id,
      videoTitle: v.title,
      label: n.label,
      text: n.detail,
      kind: "node" as const,
    }))
  );
}

/* ---------- 空间帖流（种子迁移 + 真实帖合并） ---------- */

type PostQuote = NonNullable<PostView["quote"]>;

/** 空间的延伸条目（置顶帖的原料）：视频读认知拓展，合集读合集级延伸。 */
function ownerExtend(topic: Topic): { question: string; hint: string }[] {
  if (topic.kind === "video") {
    return findVideo(topic.ownerId)?.cognitiveExpansion?.extend ?? [];
  }
  return (
    COLLECTIONS[topic.ownerId]?.cognitiveExpansion?.extend ??
    getCollectionExtend(topic.ownerId)
  );
}

/** 某脉络节点上那条回响的引文视图（旧 echo 线迁移与 echo: 引用共用）。 */
function echoQuoteOfNode(videoId: string, nodeId: string): PostQuote | undefined {
  const video = findVideo(videoId);
  const echo = video?.nodes.find((n) => n.id === nodeId)?.echo;
  if (!echo) return undefined;
  return {
    text: echoQuoteText(echo),
    source: `✦ ${echoRelationLabel(echo)}`,
    href: `/video/${videoId}`,
    kind: "echo",
  };
}

/** 置顶帖 + 种子迁移 + 真实帖合并为统一空间视图；排序在客户端做（置顶恒在最前）。
    迁移规则（docs/我的岛屿_功能设计.md §2.3）：
    - 旧延伸线（idx < 2）：整线内容平铺为对应置顶帖的回复
    - 旧延伸线（idx ≥ 2，降格淘汰）：主帖转普通帖、引原问题当锚点，回复原样跟随
    - 旧回响线：主帖转普通帖、自动带该回响的引用，回复原样跟随
    足迹：种子作者查 SEED_SEEN；"你"按本大陆真实积累算（与门槛同一口径）。 */
export function topicPosts(topicId: string, categoryId?: string): PostView[] {
  const topic = resolveTopic(topicId);
  if (!topic) return [];
  const mySeen = categoryId ? categorySeenCount(categoryId) : undefined;
  const ownerId = topic.ownerId;
  const ownerVideo = topic.kind === "video" ? findVideo(ownerId) : null;
  const extendAll = ownerExtend(topic);

  const pinned: PostView[] = extendAll.slice(0, PINNED_MAX).map((x, i) => ({
    id: `pin-${i}`,
    author: "知音",
    body: x.question,
    hint: x.hint,
    pinned: true,
    ageHours: 0,
    likes: 0,
    replies: [],
  }));
  const all: PostView[] = [...pinned];
  const byId = new Map(all.map((p) => [p.id, p]));

  /* 真实帖引文（nodeId+快照）补落款与跳回链接。key 三种形态：
     裸 nodeId（单视频空间脉络句）、`{videoId}:{nodeId}`（合集空间）、
     `echo:{nodeId}`（回响引用）。 */
  const quoteOf = (r: {
    quoteNodeId: string | null;
    quoteText: string | null;
  }): PostQuote | undefined => {
    if (!r.quoteText || !r.quoteNodeId) return undefined;
    if (r.quoteNodeId.startsWith("echo:")) {
      const nodeId = r.quoteNodeId.slice(5);
      const base = echoQuoteOfNode(ownerId, nodeId);
      return base ? { ...base, text: r.quoteText } : undefined;
    }
    const sep = r.quoteNodeId.indexOf(":");
    const videoId = sep >= 0 ? r.quoteNodeId.slice(0, sep) : ownerId;
    const nodeId = sep >= 0 ? r.quoteNodeId.slice(sep + 1) : r.quoteNodeId;
    const video = videoId === ownerId ? ownerVideo : findVideo(videoId);
    if (!video) return undefined;
    const idx = video.nodes.findIndex((n) => n.id === nodeId);
    const at = idx >= 0 ? ` · 脉络 ${String(idx + 1).padStart(2, "0")}` : "";
    return {
      text: r.quoteText,
      source: `《${video.title}》${at}`,
      href: `/video/${videoId}`,
      kind: "node",
    };
  };

  /* 降格延伸（idx ≥ 2）的帖子引原问题当锚点，别让旧内容失去上下文 */
  const questionQuote = (idx: number): PostQuote | undefined =>
    extendAll[idx]
      ? {
          text: extendAll[idx].question,
          source: `《${topic.ownerTitle}》· 延伸`,
          href: topic.backHref,
          kind: "node",
        }
      : undefined;

  const seedReplyView = (r: { author: string; body: string; agoHours: number; likes?: number }) => ({
    author: r.author,
    body: r.body,
    ageHours: r.agoHours,
    likes: r.likes ?? 0,
    seen: SEED_SEEN[r.author],
  });

  /* 种子迁移：仍按旧线 key 存（lib/discussion.ts 头注释），读取时归位 */
  const seedLine = (key: string): SeedPost[] => SEED_POSTS[key] ?? [];

  for (let i = 0; i < Math.max(extendAll.length, PINNED_MAX + 1); i++) {
    const line = seedLine(`extend.${ownerId}.${i}`);
    if (!line.length) continue;
    if (i < PINNED_MAX && pinned[i]) {
      // 整线平铺为置顶帖的回复；原主帖 id 保持 seed-N 可寻址（真实回复的 parentId 指它）
      for (let j = 0; j < line.length; j++) {
        const p = line[j];
        pinned[i].replies.push({
          id: `seed-x${i}-${j}`,
          ...seedReplyView(p),
          quote: p.quote ? { ...p.quote, href: topic.backHref, kind: "node" } : undefined,
        });
        for (const r of p.replies ?? []) pinned[i].replies.push(seedReplyView(r));
      }
    } else {
      for (let j = 0; j < line.length; j++) {
        const p = line[j];
        const view: PostView = {
          id: `seed-x${i}-${j}`,
          author: p.author,
          body: p.body,
          ageHours: p.agoHours,
          likes: p.likes,
          seen: SEED_SEEN[p.author],
          quote: p.quote
            ? { ...p.quote, href: topic.backHref, kind: "node" }
            : questionQuote(i),
          replies: (p.replies ?? []).map(seedReplyView),
        };
        all.push(view);
        byId.set(view.id, view);
      }
    }
  }

  if (ownerVideo) {
    for (const node of ownerVideo.nodes) {
      const line = seedLine(`echo.${ownerId}.${node.id}`);
      for (let j = 0; j < line.length; j++) {
        const p = line[j];
        const view: PostView = {
          id: `seed-e-${node.id}-${j}`,
          author: p.author,
          body: p.body,
          ageHours: p.agoHours,
          likes: p.likes,
          seen: SEED_SEEN[p.author],
          quote: p.quote
            ? { ...p.quote, href: topic.backHref, kind: "node" }
            : echoQuoteOfNode(ownerId, node.id),
          replies: (p.replies ?? []).map(seedReplyView),
        };
        all.push(view);
        byId.set(view.id, view);
      }
    }
  }

  /* 真实帖：新空间编码直落；旧线编码按迁移规则归位。
     旧线上的 parentId=seed-N 指的是"那条线里第 N 条种子主帖"，重映射到迁移后的 id。 */
  const rows = listTopicPostsByOwner(ownerId);
  const ageOf = (createdAt: string) =>
    Math.max(0, (Date.now() - Date.parse(createdAt)) / 3.6e6);
  const rowLine = (
    r: TopicPostRow
  ): { kind: "space" } | { kind: "extend"; idx: number } | { kind: "echo"; nodeId: string } => {
    const [k, , ...rest] = r.topicId.split(".");
    if (k === "extend") return { kind: "extend", idx: Number(rest.join(".")) };
    if (k === "echo") return { kind: "echo", nodeId: rest.join(".") };
    return { kind: "space" };
  };
  const remapParent = (parentId: string, line: ReturnType<typeof rowLine>): string => {
    const m = /^seed-(\d+)$/.exec(parentId);
    if (!m) return parentId;
    if (line.kind === "extend") return `seed-x${line.idx}-${m[1]}`;
    if (line.kind === "echo") return `seed-e-${line.nodeId}-${m[1]}`;
    return parentId;
  };

  const replyRows: { row: TopicPostRow; line: ReturnType<typeof rowLine> }[] = [];
  for (const r of rows) {
    const line = rowLine(r);
    if (r.parentId) {
      replyRows.push({ row: r, line });
      continue;
    }
    const base = {
      id: r.id,
      author: "你",
      body: r.body,
      ageHours: ageOf(r.createdAt),
      likes: 0,
      seen: mySeen,
    };
    if (line.kind === "extend" && line.idx < PINNED_MAX && pinned[line.idx]) {
      pinned[line.idx].replies.push({ ...base, quote: quoteOf(r) });
      continue;
    }
    const view: PostView = {
      ...base,
      quote:
        quoteOf(r) ??
        (line.kind === "extend"
          ? questionQuote(line.idx)
          : line.kind === "echo"
            ? echoQuoteOfNode(ownerId, line.nodeId)
            : undefined),
      replies: [],
    };
    all.push(view);
    byId.set(view.id, view);
  }
  for (const { row, line } of replyRows) {
    const reply = {
      id: row.id,
      author: "你",
      body: row.body,
      ageHours: ageOf(row.createdAt),
      likes: 0,
      seen: mySeen,
      quote: quoteOf(row),
    };
    if (line.kind === "extend" && line.idx < PINNED_MAX && pinned[line.idx]) {
      pinned[line.idx].replies.push(reply);
      continue;
    }
    byId.get(remapParent(row.parentId!, line))?.replies.push(reply);
  }
  return all;
}
