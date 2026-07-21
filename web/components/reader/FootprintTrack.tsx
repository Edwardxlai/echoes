"use client";

import { useEffect } from "react";
import { recordFootprint } from "@/lib/client/journal";

/* 足迹留痕：进入一个视频解析页即记一笔（无渲染），足迹岛读它画轨迹。
   与 ParsingBadge 同类的「常驻但不可见」组件，只是这个是页面级而非全局。 */
export function FootprintTrack({
  videoId,
  videoTitle,
  categoryId,
  collectionId,
  collectionTitle,
}: {
  videoId: string;
  videoTitle: string;
  categoryId: string;
  collectionId?: string;
  collectionTitle?: string;
}) {
  useEffect(() => {
    recordFootprint({ videoId, videoTitle, categoryId, collectionId, collectionTitle });
  }, [videoId, videoTitle, categoryId, collectionId, collectionTitle]);

  return null;
}
