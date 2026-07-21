/* ================================================================
   回响 · 讨论空间种子数据与纯函数
   机制见 docs/我的岛屿_功能设计.md §2（讨论区收拢，2026-07-20 定稿）。
   本文件客户端可安全导入——不得引 server 模块。

   topicId 编码（一视频/一合集只有一个讨论空间）：
     video.{videoId}          视频讨论空间
     collection.{collectionId} 合集讨论空间
   旧线编码 extend.{owner}.{idx} / echo.{videoId}.{nodeId} 已废弃：
   路由重定向到所属空间，种子与真实旧帖在读取层迁移合并（server/discussion.ts）。
   SEED_POSTS 仍按旧线 key 存——迁移在读取时做，不改动种子文件。
   ================================================================ */
import { SEED_POSTS_EXTEND } from "@/lib/seed-data/discussion-extend";
import { SEED_POSTS_ECHO } from "@/lib/seed-data/discussion-echo";

export interface SeedReply {
  author: string;
  agoHours: number;
  body: string;
  likes?: number;
}

export interface SeedPost {
  author: string;
  agoHours: number; // 相对时间，演示数据不会过期
  body: string;
  likes: number;
  /** quoteRef（种子版）：想法顶着的一句原文；source 直接给排好的落款文案 */
  quote?: { text: string; source: string };
  replies?: SeedReply[];
}

/** 页面/接口间传递的帖子形状（种子与真实发帖统一后的视图）。
    回复的 id 只有真实发帖才有——有 id 即"你"发的，可删；种子回复无 id 不可删。
    seen = 发言者在本大陆的阅读足迹（看过几条），纯背书展示，不做发言门槛；
    缺数据时不显示。 */
export interface PostView {
  id: string;
  author: string;
  body: string;
  ageHours: number;
  likes: number;
  seen?: number;
  /** 官方置顶提问帖（延伸点降格而来，每空间固定 ≤2 条）：body=问题，hint=AI 追问方向。
      置顶帖不显时间/同感，回复即答题。 */
  pinned?: boolean;
  hint?: string;
  /** quoteRef：想法顶着的一句原文（微信读书"想法带划线"式）；href 跳回所属解析页。
      kind="echo" 表示引的是一条回响（关系词+旧方一句），渲染带 ✦。 */
  quote?: { text: string; source: string; href: string; kind?: "node" | "echo" };
  replies: {
    id?: string;
    author: string;
    body: string;
    ageHours: number;
    likes: number;
    seen?: number;
    quote?: { text: string; source: string; href: string; kind?: "node" | "echo" };
  }[];
}

/* 种子作者的足迹（mock，同一作者全站一致；PRD 讨论区允许 mock）。 */
export const SEED_SEEN: Record<string, number> = {
  苇岸: 23,
  持灯: 17,
  闻舟: 19,
  半夏: 14,
  林河: 12,
  望野: 9,
};

/* 种子想法：PRD 讨论区允许 mock。没写种子的线是空线（还没人开口）。 */
export const SEED_POSTS: Record<string, SeedPost[]> = {
  ...SEED_POSTS_EXTEND,
  ...SEED_POSTS_ECHO,
};

export function fmtAgo(hours: number): string {
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${Math.floor(hours)} 小时前`;
  if (hours < 48) return "昨天";
  if (hours < 24 * 7) return `${Math.floor(hours / 24)} 天前`;
  return `${Math.floor(hours / (24 * 7))} 周前`;
}
