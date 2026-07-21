"use client";

import { useEffect, useRef, useState } from "react";
import { addThought, markThoughtPublished } from "@/lib/client/journal";

/* 「记下想法」：解析页里的轻量动作，不是独立模块（docs/我的岛屿_功能设计.md §3.2）。
   默认只存本机、仅自己可见；勾选「同时发表到讨论区」才会真的发帖，
   走的是同一条讨论空间（video.{id}），quoteRef 复用讨论区的引原文选择器交互
   （气质与 MoveControl 一致：点击外部/Esc 关闭，面板贴右缘下拉）。 */

interface QuoteItem {
  nodeId: string;
  label: string;
  text: string;
  kind?: "node" | "echo";
}

export function ThoughtComposer({
  videoId,
  videoTitle,
  categoryId,
  href,
  quotePool,
}: {
  videoId: string;
  videoTitle: string;
  categoryId: string;
  href: string;
  quotePool: QuoteItem[];
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [savedPublished, setSavedPublished] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  const close = () => {
    setOpen(false);
    setQuoteOpen(false);
    setError("");
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const quote = quotePool.find((q) => q.nodeId === quoteId) ?? null;

  const submit = async () => {
    const text = body.trim();
    if (!text || busy) return;
    const willPublish = publish;
    setBusy(true);
    setError("");
    // 私密记录先落本机，永远成功；发表到讨论区是可选的、可能失败的额外一步
    const thought = addThought({
      videoId,
      videoTitle,
      categoryId,
      href,
      body: text,
      anchor: quote ? { kind: quote.kind ?? "node", label: quote.label, text: quote.text } : undefined,
      published: false,
    });
    let publishOk = false;
    if (willPublish) {
      try {
        const res = await fetch("/api/topic-post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topicId: `video.${videoId}`,
            body: text,
            quoteNodeId: quoteId ?? undefined,
          }),
        });
        if (res.ok) {
          publishOk = true;
          markThoughtPublished(thought.id);
        } else {
          const data = await res.json().catch(() => null);
          setError(data?.error ?? "已记下，但没发到讨论区");
        }
      } catch {
        setError("已记下，但没发到讨论区");
      }
    }
    setBusy(false);
    setBody("");
    setQuoteId(null);
    setPublish(false);
    setSaved(true);
    setSavedPublished(willPublish && publishOk);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <span className="thoughtCtl" ref={rootRef}>
      <button
        type="button"
        className="thoughtBtn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => (open ? close() : setOpen(true))}
      >
        记下想法
      </button>
      {open && (
        <div className="thoughtPick" role="dialog" aria-label="记下想法">
          <textarea
            className="thoughtInput"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="想到什么，记一句…"
            maxLength={1000}
            autoFocus
          />
          {quote && (
            <div className="cquote">
              <span className="cqt">
                {quote.kind === "echo" && "✦ "}
                {quote.text}
              </span>
              <button
                type="button"
                className="cqx"
                aria-label="去掉引文"
                onClick={() => setQuoteId(null)}
              >
                ✕
              </button>
            </div>
          )}
          <div className="thoughtRow">
            {quotePool.length > 0 && (
              <button
                type="button"
                className={`tquote${quote ? " on" : ""}`}
                onClick={() => setQuoteOpen((v) => !v)}
              >
                引原文
              </button>
            )}
            <label className="thoughtPublish">
              <input
                type="checkbox"
                checked={publish}
                onChange={(e) => setPublish(e.target.checked)}
              />
              同时发表到讨论区
            </label>
          </div>
          {quoteOpen && (
            <div className="qpick">
              {quotePool.map((q, i) => (
                <button
                  type="button"
                  key={q.nodeId}
                  className={`qpickItem${q.nodeId === quoteId ? " on" : ""}`}
                  onClick={() => {
                    setQuoteId(q.nodeId === quoteId ? null : q.nodeId);
                    setQuoteOpen(false);
                  }}
                >
                  <span className="qpi">{String(i + 1).padStart(2, "0")}</span>
                  <span className="qpl">{q.label}</span>
                  <span className="qpt">{q.text}</span>
                </button>
              ))}
            </div>
          )}
          <div className="thoughtActs">
            {saved ? (
              <span className="thoughtSaved">✓ 已记下{savedPublished ? "，也已发到讨论区" : ""}</span>
            ) : (
              <span />
            )}
            <button type="button" className="thoughtSend" disabled={busy || !body.trim()} onClick={submit}>
              记下
            </button>
          </div>
          {error && <span className="movePick__err">{error}</span>}
        </div>
      )}
    </span>
  );
}
