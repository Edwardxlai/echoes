"use client";

import { useState } from "react";
import { addThought, formatThoughtTimestamp, useThoughts } from "@/lib/client/journal";

/* 想法：写在合集页的整组理解（挂 collectionId，不挂 videoId）和写在各集页面的想法（挂 videoId）
   按时间合并成一条流；带 videoId 的卡片顶部标一行来源集数，没有就是直接写在合集上的——
   不再用一句导语/一道分隔线复述这层区别，卡片本身已经说清楚了。 */
export function CollectionThoughts({
  collectionId,
  collectionName,
  categoryId,
  href,
  episodeVideoIds,
  videoTitles,
}: {
  collectionId: string;
  collectionName: string;
  categoryId: string;
  href: string;
  episodeVideoIds: string[];
  /** videoId → 标题；服务端传对象而不是函数，函数不能跨 RSC 边界传给客户端组件。 */
  videoTitles: Record<string, string>;
}) {
  const [body, setBody] = useState("");
  const [saved, setSaved] = useState(false);
  const all = useThoughts();
  const combined = all
    .filter((t) => t.collectionId === collectionId || (t.videoId && episodeVideoIds.includes(t.videoId)))
    .sort((a, b) => b.createdAt - a.createdAt);

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    addThought({ videoTitle: collectionName, categoryId, href, body: text, collectionId });
    setBody("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="tbar">
      <div className="tcompose">
        <textarea
          className="tcInput"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          placeholder="整组下来，你的理解是…"
          rows={1}
          maxLength={1000}
        />
        <button type="button" className="tcSend" disabled={!body.trim()} onClick={submit}>
          记下
        </button>
      </div>
      {saved && <div className="tcSaved">✓ 已记下</div>}
      {combined.length > 0 && (
        <div className="tentryList">
          {combined.map((t) => (
            <div key={t.id} className="tentry">
              {t.videoId && <span className="tentrySrc">{videoTitles[t.videoId] ?? t.videoTitle}</span>}
              <p className="tentryText">{t.body}</p>
              <time className="tentryTime">{formatThoughtTimestamp(t.createdAt)}</time>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
