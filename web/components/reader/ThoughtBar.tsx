"use client";

import { useState } from "react";
import { addThought, formatThoughtTimestamp, useThoughts } from "@/lib/client/journal";

/* 页尾想法栏：读完这条视频，就着整条留一句想法（不引用具体节点）。
   写入独立的用户记录层（journal），与 AI 生成内容互不写入；已留的想法安静列在下方。 */

export function ThoughtBar({
  videoId,
  videoTitle,
  categoryId,
  href,
}: {
  videoId: string;
  videoTitle: string;
  categoryId: string;
  href: string;
}) {
  const [body, setBody] = useState("");
  const [saved, setSaved] = useState(false);
  const mine = useThoughts().filter((t) => t.videoId === videoId);

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    addThought({ videoId, videoTitle, categoryId, href, body: text });
    setBody("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="tbar">
      {mine.length > 0 && (
        <>
          <p className="tentryLabel">你之前记下的</p>
          <div className="tentryList">
            {mine.map((t) => (
              <div key={t.id} className="tentry">
                <p className="tentryText">{t.body}</p>
                <time className="tentryTime">{formatThoughtTimestamp(t.createdAt)}</time>
              </div>
            ))}
          </div>
          <hr className="tdivider" />
        </>
      )}
      <div className="tcompose">
        <textarea
          className="tcInput"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          placeholder="读完这条，记一句想法…"
          rows={1}
          maxLength={1000}
        />
        <button type="button" className="tcSend" disabled={!body.trim()} onClick={submit}>
          记下
        </button>
      </div>
      {saved && <div className="tcSaved">✓ 已记下</div>}
    </div>
  );
}
