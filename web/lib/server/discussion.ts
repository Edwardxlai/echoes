/* ================================================================
   回响 · 同题空间服务端逻辑（讨论区 P0）
   门槛 = 数据结构（机制稿 §二），不建等级表：
   - 延伸题线：该大类下积累 ≥ GATE_NEED 条才可发言（2026-07-16 定稿口径）
   - 回响交点线：能看到入口即已回响到，自动解锁
   数据源两层与全站一致：种子（lib/data.ts）优先，miss 查真实解析（store）。
   ================================================================ */
import type { Echo, Video } from "@/lib/data";
import { COLLECTIONS, VIDEOS, getCategory } from "@/lib/data";
import { SEED_POSTS, SEED_SEEN, type Gate, type PostView } from "@/lib/discussion";
import {
  countAnalyzedByCategory,
  getAsset,
  getCollectionExtend,
  getCollectionRow,
  getParsedVideo,
  hasRealMapContent,
  listAssetsByCollection,
  listTopicPosts,
} from "./store";

export const GATE_NEED = 3;

/** 门槛跟随地图的数据源开关：有真实内容按真实解析数算，否则按种子观看史算。 */
export function categoryGate(categoryId: string): Gate {
  const have = hasRealMapContent()
    ? countAnalyzedByCategory(categoryId)
    : Object.values(VIDEOS).filter(
        (v) => v.viewed && COLLECTIONS[v.collectionId]?.categoryId === categoryId
      ).length;
  return {
    unlocked: have >= GATE_NEED,
    have,
    need: GATE_NEED,
    categoryId,
    categoryName: getCategory(categoryId)?.name ?? categoryId,
  };
}

export type Topic =
  | {
      kind: "extend";
      question: string;
      ownerTitle: string;
      backHref: string;
      categoryId: string;
    }
  | {
      kind: "echo";
      echo: Echo;
      videoTitle: string;
      backHref: string;
      categoryId: string;
    };

export function resolveTopic(topicId: string): Topic | null {
  const [kind, ownerId, ...rest] = topicId.split(".");
  if (!ownerId || !rest.length) return null;

  if (kind === "extend") {
    const idx = Number(rest.join("."));
    if (!Number.isInteger(idx) || idx < 0) return null;

    const seedVideo = VIDEOS[ownerId];
    if (seedVideo) {
      const item = seedVideo.cognitiveExpansion.extend[idx];
      if (!item) return null;
      return {
        kind: "extend",
        question: item.question,
        ownerTitle: seedVideo.title,
        backHref: `/video/${ownerId}`,
        categoryId: COLLECTIONS[seedVideo.collectionId]?.categoryId ?? "",
      };
    }
    const parsed = getParsedVideo(ownerId);
    if (parsed) {
      const item = parsed.cognitiveExpansion?.extend[idx];
      if (!item) return null;
      return {
        kind: "extend",
        question: item.question,
        ownerTitle: parsed.title,
        backHref: `/video/${ownerId}`,
        categoryId: getAsset(ownerId)?.bigCategoryId ?? "",
      };
    }
    const seedCollection = COLLECTIONS[ownerId];
    if (seedCollection) {
      const item = seedCollection.cognitiveExpansion?.extend[idx];
      if (!item) return null;
      return {
        kind: "extend",
        question: item.question,
        ownerTitle: seedCollection.name,
        backHref: `/collection/${ownerId}/synthesis`,
        categoryId: seedCollection.categoryId,
      };
    }
    const realCollection = getCollectionRow(ownerId);
    if (realCollection) {
      const item = getCollectionExtend(ownerId)[idx];
      if (!item) return null;
      return {
        kind: "extend",
        question: item.question,
        ownerTitle: realCollection.name,
        backHref: `/collection/${ownerId}/synthesis`,
        categoryId: realCollection.categoryId,
      };
    }
    return null;
  }

  if (kind === "echo") {
    const nodeId = rest.join(".");
    const video = VIDEOS[ownerId] ?? getParsedVideo(ownerId);
    const node = video?.nodes.find((n) => n.id === nodeId);
    if (!video || !node?.echo) return null;
    return {
      kind: "echo",
      echo: node.echo,
      videoTitle: video.title,
      backHref: `/video/${ownerId}`,
      categoryId: VIDEOS[ownerId]
        ? COLLECTIONS[VIDEOS[ownerId].collectionId]?.categoryId ?? ""
        : getAsset(ownerId)?.bigCategoryId ?? "",
    };
  }
  return null;
}

export interface QuoteItem {
  /** 可引池内唯一 key：单视频题直接用节点 id；合集题跨视频聚合，
      加 `{videoId}:` 前缀避免不同集的节点 id 撞车。 */
  nodeId: string;
  videoId: string;
  videoTitle: string;
  label: string;
  text: string;
}

/** quoteRef 的可引池：同题空间所属视频的脉络节点。
    合集延伸题没有自己的脉络（PRD 否决系列脉络），但每个成员视频仍各自有脉络——
    池聚合所有成员视频的节点，composer 先选集再选句（2026-07-19 用户定稿）。 */
export function topicQuotePool(topicId: string): QuoteItem[] {
  const ownerId = topicId.split(".")[1] ?? "";
  const video = VIDEOS[ownerId] ?? getParsedVideo(ownerId);
  if (video) {
    return video.nodes.map((n) => ({
      nodeId: n.id,
      videoId: ownerId,
      videoTitle: video.title,
      label: n.label,
      text: n.detail,
    }));
  }
  const memberVideos: (Video | NonNullable<ReturnType<typeof getParsedVideo>>)[] =
    COLLECTIONS[ownerId]
      ? COLLECTIONS[ownerId].videoIds.map((id) => VIDEOS[id]).filter((v): v is Video => !!v)
      : listAssetsByCollection(ownerId)
          .map((a) => getParsedVideo(a.id))
          .filter((v): v is NonNullable<ReturnType<typeof getParsedVideo>> => !!v);
  return memberVideos.flatMap((v) =>
    v.nodes.map((n) => ({
      nodeId: `${v.id}:${n.id}`,
      videoId: v.id,
      videoTitle: v.title,
      label: n.label,
      text: n.detail,
    }))
  );
}

/** 种子想法 + 本地真实发帖合并为统一视图；排序在客户端做（最新/热门双 tab）。
    真实发帖带 parentId 的是回复，挂到对应帖（种子帖 id=seed-N 静态稳定）。
    足迹：种子作者查 SEED_SEEN；"你"按本大陆真实积累算（与门槛同一口径）。
    引文：真实帖存 nodeId+快照，这里补落款（《标题》· 脉络 NN）与跳回链接。 */
export function topicPosts(topicId: string, categoryId?: string): PostView[] {
  const mySeen = categoryId ? categoryGate(categoryId).have : undefined;
  const ownerId = topicId.split(".")[1] ?? "";
  const ownerVideo = VIDEOS[ownerId] ?? getParsedVideo(ownerId);
  const quoteHref = `/video/${ownerId}`;
  /* 引文可能来自合集聚合池（key = `{videoId}:{nodeId}`）或单视频题（key = 裸 nodeId，
     此时视频就是 ownerVideo）——先拆前缀定位是哪一集，再查那集的脉络下标。 */
  const quoteOf = (r: { quoteNodeId: string | null; quoteText: string | null }) => {
    if (!r.quoteText || !r.quoteNodeId) return undefined;
    const sep = r.quoteNodeId.indexOf(":");
    const videoId = sep >= 0 ? r.quoteNodeId.slice(0, sep) : ownerId;
    const nodeId = sep >= 0 ? r.quoteNodeId.slice(sep + 1) : r.quoteNodeId;
    const video = videoId === ownerId ? ownerVideo : VIDEOS[videoId] ?? getParsedVideo(videoId);
    if (!video) return undefined;
    const idx = video.nodes.findIndex((n) => n.id === nodeId);
    const at = idx >= 0 ? ` · 脉络 ${String(idx + 1).padStart(2, "0")}` : "";
    return {
      text: r.quoteText,
      source: `《${video.title}》${at}`,
      href: `/video/${videoId}`,
    };
  };
  const seeds: PostView[] = (SEED_POSTS[topicId] ?? []).map((p, i) => ({
    id: `seed-${i}`,
    author: p.author,
    body: p.body,
    ageHours: p.agoHours,
    likes: p.likes,
    seen: SEED_SEEN[p.author],
    quote: p.quote && ownerVideo ? { ...p.quote, href: quoteHref } : undefined,
    replies: (p.replies ?? []).map((r) => ({
      author: r.author,
      body: r.body,
      ageHours: r.agoHours,
      likes: r.likes ?? 0,
      seen: SEED_SEEN[r.author],
    })),
  }));
  const rows = listTopicPosts(topicId);
  const ageOf = (createdAt: string) =>
    Math.max(0, (Date.now() - Date.parse(createdAt)) / 3.6e6);
  const mine: PostView[] = rows
    .filter((r) => !r.parentId)
    .map((r) => ({
      id: r.id,
      author: "你",
      body: r.body,
      ageHours: ageOf(r.createdAt),
      likes: 0,
      seen: mySeen,
      quote: quoteOf(r),
      replies: [],
    }));
  const all = [...seeds, ...mine];
  const byId = new Map(all.map((p) => [p.id, p]));
  for (const r of rows) {
    if (!r.parentId) continue;
    byId.get(r.parentId)?.replies.push({
      id: r.id,
      author: "你",
      body: r.body,
      ageHours: ageOf(r.createdAt),
      likes: 0,
      seen: mySeen,
      quote: quoteOf(r),
    });
  }
  return all;
}
