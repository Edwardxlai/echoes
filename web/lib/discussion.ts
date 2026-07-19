/* ================================================================
   回响 · 同题空间（讨论区 P0）种子数据与纯函数
   机制见 docs/讨论区设计方案_V1.md，视觉见 docs/讨论区视觉交互方案_V1.md。
   本文件客户端可安全导入（EchoBlock 入口要读种子人数）——不得引 server 模块。

   topicId 编码：
     extend.{videoId|collectionId}.{extendIdx}   延伸题线
     echo.{videoId}.{nodeId}                     回响交点线
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

/** 门槛状态（服务端算好传给客户端渲染）。 */
export interface Gate {
  unlocked: boolean;
  have: number;
  need: number;
  categoryId: string;
  categoryName: string;
}

/** 页面/接口间传递的帖子形状（种子与真实发帖统一后的视图）。
    回复的 id 只有真实发帖才有——有 id 即"你"发的，可删；种子回复无 id 不可删。
    seen = 发言者在本大陆的阅读足迹（看过几条）——门槛解锁后资格仍可见，
    gated 的价值从"拦人"变成"背书"；缺数据时不显示。 */
export interface PostView {
  id: string;
  author: string;
  body: string;
  ageHours: number;
  likes: number;
  seen?: number;
  /** quoteRef：想法顶着的一句原文（微信读书"想法带划线"式）；href 跳回所属解析页 */
  quote?: { text: string; source: string; href: string };
  replies: {
    id?: string;
    author: string;
    body: string;
    ageHours: number;
    likes: number;
    seen?: number;
    quote?: { text: string; source: string; href: string };
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
