/* ================================================================
   评论主题热度（重构方案 §8）
   帮助用户快速看到：围绕这条视频，其他观看者最可能集中讨论什么——不是讨论区，
   只做理解增强，引发用户自己记想法。
   §8.3 数据边界：内容感知的模拟数据（L4b，解析时按视频内容生成并落库），
   不宣称在抓官方评论；接入平台后才用平台聚合互动数据。生成逻辑见 lib/server/pipeline.ts。
   ================================================================ */

export interface HeatTopic {
  label: string;   // 柱下短标签
  heat: number;    // 相对热度 0–100，决定柱高
  focus: string;   // 主要讨论焦点（一句）
  comment: string; // 代表性评论（一条）
}

export interface CommentHeat {
  note: string;    // 数据口径标注（示例/聚合）
  topics: HeatTopic[]; // 已按热度从高到低排好
}

export const COMMENT_HEAT_NOTE = "评论区聚合 · 示例数据";
