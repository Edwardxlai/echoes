"use client";

import { useEffect, useRef, useState } from "react";

/* 解析页「分享」：把这条视频的解析精华压成一张 9:16 卡片（热议卡），
   点击弹出预览 → html-to-image 截成 PNG → 保存图片。
   与「查看原视频」同级；替换了原来的「移动」低频入口。
   卡片数据全来自真实解析：核心问题当钩子、评论热度当「大家在争论什么」、封面转正。
   底部二维码由本机 origin + /video/videoId 现算，扫码直达公网解析页——图片真正可跳转。 */

export interface ShareTopic {
  label: string;
  heat: number;
}

export function ShareButton({
  videoId,
  hook,
  title,
  creator,
  duration,
  cover,
  topics,
}: {
  videoId: string;
  hook: string;
  title: string;
  creator: string;
  duration: string;
  cover: string;
  topics: ShareTopic[];
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string>("");
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // 打开时按当前 origin 现算二维码：公网站点得公网域名，本地得 localhost，无需写死。
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const url = `${window.location.origin}/video/${videoId}`;
    import("qrcode").then(({ toDataURL }) =>
      toDataURL(url, {
        margin: 0,
        width: 240,
        color: { dark: "#1c1a16", light: "#faf9f6" },
      }).then((data) => {
        if (alive) setQr(data);
      }),
    );
    return () => {
      alive = false;
    };
  }, [open, videoId]);

  const render = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    const { toBlob } = await import("html-to-image");
    // pixelRatio 拉高保证转发到社交平台不糊；字体在弹层里已加载，截图即真实样式
    return toBlob(cardRef.current, { pixelRatio: 2.5, backgroundColor: "#faf9f6" });
  };

  const filename = `知音-${title.slice(0, 20) || videoId}.png`;

  const onSave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await render();
      if (blob) triggerDownload(blob, filename);
    } finally {
      setBusy(false);
    }
  };

  const heats = topics.map((t) => t.heat);
  const maxHeat = heats.length ? Math.max(...heats, 1) : 1;
  const shown = topics.slice(0, 4);

  return (
    <>
      <button
        type="button"
        className="shareBtn"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        分享
      </button>

      {open && (
        <div
          className="shareOverlay"
          role="dialog"
          aria-modal="true"
          aria-label="分享卡片"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="shareSheet">
            {/* ===== 被截图的卡片 ===== */}
            <div className="scCard" ref={cardRef}>
              <svg
                className="scLogo"
                viewBox="0 0 100 52"
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label="知音"
              >
                <path
                  fill="#1c1a16"
                  d="M25.5 5.6c4.4-.4 5.5 4.4 8.4 6.1 2.6 1.5 6.1.6 7.8 3.4 1.8 2.9-.7 5.8.6 8.7 1.5 3.2 4.8 5.2 3.7 8.8-1 3.3-4.8 3.6-6.2 6.7-1.5 3.4-2.9 6.8-6.9 7.2-3.7.4-5.7-3.1-9.1-3.8-3.5-.8-7.2.1-9.3-3.1-2.1-3.2.8-6.1-.1-9.6-.9-3.3-4.1-5.6-2.7-9 1.3-3.3 5.2-3.5 7.5-5.8 2.8-2.7 2.4-9.2 6.3-9.6Z"
                />
                <path
                  fill="none"
                  stroke="#1c1a16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3.2"
                  d="M75.3 8.4c4-.2 5.1 4.1 8.2 5.5 2.8 1.2 6.2 1.7 7 5 .9 3.3-2.2 5.5-1.4 8.8.8 3.2 3.1 6 .9 8.9-2.1 2.8-5.6 2.1-7.9 4.7-2.3 2.7-3.7 6.4-7.6 6.1-3.6-.2-4.8-4-7.8-5.6-3-1.7-6.9-1.8-7.8-5.3-.8-3.3 2.2-5.5 1.5-8.8-.6-3.1-3.6-5.5-2-8.6 1.6-3.2 5.5-2.9 8-5.4 2.5-2.4 5.2-5.1 8.9-5.3Z"
                />
                <path
                  fill="none"
                  stroke="#c89224"
                  strokeLinecap="round"
                  strokeWidth="2.7"
                  d="M42.5 28.8Q53 38 65.3 28.7"
                />
                <circle cx="42.5" cy="28.8" r="4.6" fill="#faf9f6" />
                <circle cx="42.5" cy="28.8" r="3.1" fill="#c89224" />
                <circle cx="65.3" cy="28.7" r="3.1" fill="#c89224" />
              </svg>

              <h2 className="scHook">{hook}</h2>

              {shown.length > 0 && (
                <>
                  <div className="scChartLab">大家在争论什么</div>
                  <div className="scBars">
                    {shown.map((t, i) => (
                      <div className={`scBar b${i + 1}`} key={t.label + i}>
                        <div
                          className="scCol"
                          style={{ height: `${Math.round((t.heat / maxHeat) * 100)}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="scXaxis">
                    {shown.map((t, i) => (
                      <span key={t.label + i}>{t.label}</span>
                    ))}
                  </div>
                </>
              )}

              <div className="scSrc">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 需原生 <img> 供 html-to-image 内联截图
                  <img className="scCover" src={cover} alt="" />
                ) : (
                  <div className="scCover scCover--ph" aria-hidden="true" />
                )}
                <div className="scMeta">
                  <div className="scTitle">{title}</div>
                  <div className="scBy">
                    {[creator, duration].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>

              <div className="scCta">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL，供 html-to-image 内联截图
                  <img className="scQr" src={qr} alt="" />
                ) : (
                  <div className="scQr scQr--ph" aria-hidden="true" />
                )}
                <div className="scCtaText">
                  <div className="scCtaTitle">扫码看完整解析</div>
                  <div className="scCtaSub">脉络 · 补缺 · 回响，都在知音</div>
                </div>
              </div>
            </div>

            {/* ===== 操作区（不进截图） ===== */}
            <div className="shareActions">
              <button type="button" className="shareAct shareAct--primary" onClick={onSave} disabled={busy}>
                {busy ? "生成中…" : "保存图片"}
              </button>
              <button type="button" className="shareAct shareAct--ghost" onClick={() => setOpen(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
