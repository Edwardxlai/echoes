"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmtAgo, type Gate, type PostView } from "@/lib/discussion";

/* 同题空间帖流（方案 A·左轨墨点流）：每条想法是脉络上的一个点，
   左轨发丝线 + 实心墨点成"面"，逐帖不套盒（v3.2 红线）。
   热门 = 同感数从高到低（2026-07-17 用户定稿，覆盖机制稿的时间衰减）。
   回复走抖音式：点谁的卡片就是回复谁——点主评论=回复它，点某条回复=
   预填"回复 某某："扁平落同层，不无限缩进；没有独立"回复"按钮。
   自己发的（author=你）可删，两击确认不弹窗；删主帖连带删其下回复。
   composer 挂在脉络末端：空心墨点聚焦点实。同感是本地态（P0 允许 mock），
   发帖/回复/删除真落库。 */

type TabKey = "最新" | "热门";

/* 墨点随同感沉淀（方案4）：热帖的点更大更沉，冷帖缩小退墨——
   热度不用切 tab，扫一眼左轨就能看到哪几笔是重的。 */
const dotClass = (likes: number) =>
  likes >= 7 ? " d3" : likes >= 4 ? " d2" : likes >= 1 ? "" : " d0";

export function TopicThread({
  topicId,
  posts,
  gate,
  quotePool = [],
}: {
  topicId: string;
  posts: PostView[];
  gate: Gate | null; // null = 回响线，自动解锁
  /** quoteRef 可引池（所属视频的脉络节点，合集题聚合了每个成员视频）；
      空池不出现「引原文」入口。跨视频时 nodeId 带 `{videoId}:` 前缀避免撞车。 */
  quotePool?: { nodeId: string; videoId: string; videoTitle: string; label: string; text: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("最新");
  const [liked, setLiked] = useState<ReadonlySet<string>>(new Set());
  const [openReplies, setOpenReplies] = useState<ReadonlySet<string>>(new Set());
  const [text, setText] = useState("");
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [armed, setArmed] = useState<string | null>(null); // 待二次确认删除的 id
  const [quoteId, setQuoteId] = useState<string | null>(null); // 已选中的引文节点
  const [quoteOpen, setQuoteOpen] = useState(false); // 引原文选择器展开
  const [quoteVideoId, setQuoteVideoId] = useState<string | null>(null); // 合集题：先选中的集
  // 回复也能带引文（2026-07-19 用户定稿，此前只有主帖能引）：按 parentId 建 Record，
  // 每条展开的回应区各自独立选引文，互不影响。
  const [replyQuoteId, setReplyQuoteId] = useState<Record<string, string>>({});
  const [replyQuoteOpen, setReplyQuoteOpen] = useState<Record<string, boolean>>({});
  const [replyQuoteVideoId, setReplyQuoteVideoId] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replyInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const unlocked = !gate || gate.unlocked;
  // 我同感过的排最前（用户定稿），其后才按 tab 的口径排
  const myLikedFirst = (a: PostView, b: PostView) =>
    (liked.has(b.id) ? 1 : 0) - (liked.has(a.id) ? 1 : 0);
  const sorted =
    tab === "热门"
      ? [...posts].sort((a, b) => myLikedFirst(a, b) || b.likes - a.likes || a.ageHours - b.ageHours)
      : [...posts].sort((a, b) => myLikedFirst(a, b) || a.ageHours - b.ageHours);

  const toggleIn = (set: ReadonlySet<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const post = async (
    body: string,
    parentId?: string,
    quoteNodeId?: string
  ): Promise<boolean> => {
    if (!body || busy) return false;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/topic-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, body, parentId, quoteNodeId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErr(data?.error ?? "没发出去，稍后再试");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setErr("没发出去，稍后再试");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitMain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await post(text.trim(), undefined, quoteId ?? undefined)) {
      setText("");
      setQuoteId(null);
      closeQuotePicker();
    }
  };

  const submitReply = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    const body = (replyText[parentId] ?? "").trim();
    if (await post(body, parentId, replyQuoteId[parentId])) {
      setReplyText((m) => ({ ...m, [parentId]: "" }));
      setReplyQuoteId((m) => {
        const next = { ...m };
        delete next[parentId];
        return next;
      });
      closeReplyQuotePicker(parentId);
    }
  };

  /* 抖音式：点谁的卡片就是回复谁（2026-07-17 用户定稿，取代独立"回复"按钮）。
     点主评论卡片=回复该评论（若输入行只剩别人的"回复 某某："纯前缀则清掉）；
     点某条回复的卡片=预填"回复 某某："（扁平二级）。都展开回应区并聚焦输入行。 */
  const openAndFocus = (postId: string, replyAuthor?: string) => {
    setOpenReplies((s) => (s.has(postId) ? s : new Set(s).add(postId)));
    setReplyText((m) => {
      const v = m[postId] ?? "";
      if (replyAuthor) return { ...m, [postId]: `回复 ${replyAuthor}：` };
      return /^回复 .{1,24}：$/.test(v) ? { ...m, [postId]: "" } : m;
    });
    setTimeout(() => replyInputs.current[postId]?.focus(), 0);
  };

  /* 卡片点击只在空白处生效——按钮/输入行/链接自己管自己 */
  const isCardBlank = (e: React.MouseEvent) =>
    !(e.target as HTMLElement).closest("button,input,a,form");

  /* 主评论卡片=开关：一次展开并聚焦，再点一次收回（没有专门的收起按钮）。
     回应区内部的点击不算——别在挑回复对象时把整块收了。 */
  const toggleCard = (e: React.MouseEvent, postId: string) => {
    if (!isCardBlank(e) || (e.target as HTMLElement).closest(".treplies")) return;
    if (openReplies.has(postId)) {
      setOpenReplies((s) => toggleIn(s, postId));
    } else {
      openAndFocus(postId);
    }
  };

  const remove = async (id: string) => {
    if (armed !== id) {
      setArmed(id);
      if (disarmTimer.current) clearTimeout(disarmTimer.current);
      disarmTimer.current = setTimeout(() => setArmed(null), 2500);
      return;
    }
    setArmed(null);
    setErr("");
    try {
      const res = await fetch("/api/topic-post", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        setErr("没删掉，稍后再试");
        return;
      }
      router.refresh();
    } catch {
      setErr("没删掉，稍后再试");
    }
  };

  const likeButton = (key: string, likes: number) => {
    const isLiked = liked.has(key);
    return (
      <button
        className={isLiked ? "on" : ""}
        onClick={() => setLiked((s) => toggleIn(s, key))}
      >
        <span className="apip" aria-hidden />
        同感 {likes + (isLiked ? 1 : 0)}
      </button>
    );
  };

  const deleteButton = (id: string) => (
    <button className={`tdel${armed === id ? " arm" : ""}`} onClick={() => remove(id)}>
      {armed === id ? "确认删除" : "删除"}
    </button>
  );

  // 合集题聚合了多集节点——先按出现顺序去重出集列表，两集以上才需要「先选集」
  const poolVideos: { videoId: string; videoTitle: string }[] = [];
  for (const q of quotePool) {
    if (!poolVideos.some((v) => v.videoId === q.videoId)) {
      poolVideos.push({ videoId: q.videoId, videoTitle: q.videoTitle });
    }
  }
  const multiVideo = poolVideos.length > 1;
  const closeQuotePicker = () => {
    setQuoteOpen(false);
    setQuoteVideoId(null);
  };
  const closeReplyQuotePicker = (parentId: string) => {
    setReplyQuoteOpen((m) => ({ ...m, [parentId]: false }));
    setReplyQuoteVideoId((m) => {
      const next = { ...m };
      delete next[parentId];
      return next;
    });
  };

  /* 引原文控件（composer 和每条回复框共用同一套拼装逻辑）：
     bar=已选引文条，button=「引原文」开关，panel=选集/选句两级面板。 */
  const quotePicker = (opts: {
    id: string | null;
    videoId: string | null;
    open: boolean;
    onOpen: () => void;
    onPickVideo: (videoId: string) => void;
    onBackVideo: () => void;
    onPick: (nodeId: string) => void;
    onRemove: () => void;
  }) => {
    const item = quotePool.find((q) => q.nodeId === opts.id) ?? null;
    return {
      item,
      bar: item && (
        <div className="cquote">
          <span className="cqt">
            {item.text}
            {multiVideo && <span className="cqs">《{item.videoTitle}》</span>}
          </span>
          <button type="button" className="cqx" aria-label="去掉引文" onClick={opts.onRemove}>
            ✕
          </button>
        </div>
      ),
      button: quotePool.length > 0 && (
        <button
          type="button"
          className={`tquote${item ? " on" : ""}`}
          onClick={opts.onOpen}
        >
          引原文
        </button>
      ),
      panel: opts.open && (
        <>
          {multiVideo && !opts.videoId && (
            <div className="qpick">
              {poolVideos.map((v) => (
                <button
                  type="button"
                  key={v.videoId}
                  className="qpickVideo"
                  onClick={() => opts.onPickVideo(v.videoId)}
                >
                  {v.videoTitle}
                </button>
              ))}
            </div>
          )}
          {(!multiVideo || opts.videoId) && (
            <div className="qpick">
              {multiVideo && (
                <button type="button" className="qpickBack" onClick={opts.onBackVideo}>
                  ‹ 换一集
                </button>
              )}
              {quotePool
                .filter((q) => !multiVideo || q.videoId === opts.videoId)
                .map((q, i) => (
                  <button
                    type="button"
                    key={q.nodeId}
                    className={`qpickItem${q.nodeId === opts.id ? " on" : ""}`}
                    onClick={() => opts.onPick(q.nodeId)}
                  >
                    <span className="qpi">{String(i + 1).padStart(2, "0")}</span>
                    <span className="qpl">{q.label}</span>
                    <span className="qpt">{q.text}</span>
                  </button>
                ))}
            </div>
          )}
        </>
      ),
    };
  };

  const mainQuote = quotePicker({
    id: quoteId,
    videoId: quoteVideoId,
    open: quoteOpen,
    onOpen: () => setQuoteOpen((v) => !v),
    onPickVideo: (videoId) => setQuoteVideoId(videoId),
    onBackVideo: () => setQuoteVideoId(null),
    onPick: (nodeId) => {
      setQuoteId(nodeId === quoteId ? null : nodeId);
      closeQuotePicker();
    },
    onRemove: () => setQuoteId(null),
  });

  const composer = (
    <form className="tpost tcrow" onSubmit={submitMain}>
      <span className="tpdot hollow" aria-hidden />
      <div className="tcomposeCol">
        {mainQuote.bar}
        <div className="tcompose">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={mainQuote.item ? "接着这句说…" : "说说你的判断…"}
            maxLength={1000}
          />
          {mainQuote.button}
          <button className="tsend" type="submit" disabled={busy || !text.trim()}>
            发送 ↑
          </button>
        </div>
        {mainQuote.panel}
      </div>
    </form>
  );

  return (
    <>
      {posts.length > 1 && (
        <div className="tnav">
          <span aria-hidden />
          <div className="tnavBtns" role="tablist">
            {(["最新", "热门"] as TabKey[]).map((t) => (
              <button
                key={t}
                className={`tnavBtn${t === tab ? " on" : ""}`}
                role="tab"
                aria-selected={t === tab}
                onClick={() => setTab(t)}
              >
                <span className="tpip" aria-hidden />
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {posts.length === 0 ? (
        <>
          <p className="tempty">
            {unlocked ? "这里还没人开口——第一句是你的。" : "这里还没人开口。"}
          </p>
          {unlocked && composer}
        </>
      ) : (
        <div className={`tstream${unlocked ? "" : " nofin"}`} key={tab}>
          {sorted.map((p) => {
            const repliesOpen = openReplies.has(p.id);
            const replyQuote = quotePicker({
              id: replyQuoteId[p.id] ?? null,
              videoId: replyQuoteVideoId[p.id] ?? null,
              open: replyQuoteOpen[p.id] ?? false,
              onOpen: () =>
                setReplyQuoteOpen((m) => ({ ...m, [p.id]: !(m[p.id] ?? false) })),
              onPickVideo: (videoId) =>
                setReplyQuoteVideoId((m) => ({ ...m, [p.id]: videoId })),
              onBackVideo: () =>
                setReplyQuoteVideoId((m) => {
                  const next = { ...m };
                  delete next[p.id];
                  return next;
                }),
              onPick: (nodeId) => {
                setReplyQuoteId((m) => {
                  const next = { ...m };
                  if (nodeId === m[p.id]) delete next[p.id];
                  else next[p.id] = nodeId;
                  return next;
                });
                closeReplyQuotePicker(p.id);
              },
              onRemove: () =>
                setReplyQuoteId((m) => {
                  const next = { ...m };
                  delete next[p.id];
                  return next;
                }),
            });
            return (
              <div className="tpost" key={p.id}>
                <span className={`tpdot${dotClass(p.likes)}`} />
                <div className="tpbody" onClick={(e) => toggleCard(e, p.id)}>
                  <div className="tpwho">
                    <span className="tpname">{p.author}</span>
                    {p.seen != null && <span className="tpseen">看过 {p.seen} 条</span>}
                    <span className="tptime">{fmtAgo(p.ageHours)}</span>
                  </div>
                  {p.quote && (
                    <Link className="pquote" href={p.quote.href}>
                      <span className="pqt">{p.quote.text}</span>
                      <span className="pqs">{p.quote.source}</span>
                    </Link>
                  )}
                  <div className="tptext">{p.body}</div>
                  <div className="tpacts">
                    {likeButton(p.id, p.likes)}
                    {!repliesOpen && p.replies.length > 0 && (
                      <button onClick={() => setOpenReplies((s) => toggleIn(s, p.id))}>
                        展开 {p.replies.length} 条回复
                      </button>
                    )}
                    {p.author === "你" && deleteButton(p.id)}
                  </div>
                  {repliesOpen && (
                    <div className="treplies">
                      {p.replies.map((r, i) => (
                        <div
                          className="treply"
                          key={r.id ?? i}
                          onClick={(e) => {
                            if (!isCardBlank(e)) return;
                            e.stopPropagation();
                            openAndFocus(p.id, r.author);
                          }}
                        >
                          <div className="tpwho">
                            <span className="tpname">{r.author}</span>
                            {r.seen != null && (
                              <span className="tpseen">看过 {r.seen} 条</span>
                            )}
                            <span className="tptime">{fmtAgo(r.ageHours)}</span>
                          </div>
                          {r.quote && (
                            <Link className="pquote" href={r.quote.href}>
                              <span className="pqt">{r.quote.text}</span>
                              <span className="pqs">{r.quote.source}</span>
                            </Link>
                          )}
                          <div className="tptext">{r.body}</div>
                          <div className="tpacts">
                            {likeButton(r.id ?? `${p.id}#s${i}`, r.likes)}
                            {r.id && r.author === "你" && deleteButton(r.id)}
                          </div>
                        </div>
                      ))}
                      {unlocked && (
                        <form className="rcomposeCol" onSubmit={(e) => submitReply(e, p.id)}>
                          {replyQuote.bar}
                          <div className="rcomposeRow">
                            <input
                              ref={(el) => {
                                replyInputs.current[p.id] = el;
                              }}
                              value={replyText[p.id] ?? ""}
                              onChange={(e) =>
                                setReplyText((m) => ({ ...m, [p.id]: e.target.value }))
                              }
                              placeholder={`回复 ${p.author}…`}
                              maxLength={1000}
                            />
                            {replyQuote.button}
                            <button
                              className="tsend"
                              type="submit"
                              disabled={busy || !(replyText[p.id] ?? "").trim()}
                            >
                              发送 ↑
                            </button>
                          </div>
                          {replyQuote.panel}
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {unlocked && composer}
        </div>
      )}

      {!unlocked && (
        <>
          <div className="lockline">
            <span>🔒 在{gate!.categoryName}大陆看够 {gate!.need} 条才能开口</span>
            <span className="gdots" aria-hidden>
              {Array.from({ length: gate!.need }, (_, i) =>
                i < gate!.have ? "●" : "○"
              ).join(" ")}
            </span>
            <span>还差 {gate!.need - gate!.have} 条</span>
          </div>
          <Link className="door" href={`/category/${gate!.categoryId}`}>
            去{gate!.categoryName}大陆看看 →
          </Link>
        </>
      )}
      {err && <div className="terr">{err}</div>}
    </>
  );
}
