"use client";

import { useEffect, useRef, useState } from "react";

export interface CollectionShareEpisode {
  title: string;
  /** 由合集 L6 分析生成，不允许从标题机械截断。 */
  label?: string;
  heat: number;
  cover?: string;
}

export function CollectionShareButton({
  collectionId,
  hook,
  name,
  creator,
  cover,
  episodes,
}: {
  collectionId: string;
  hook: string;
  name: string;
  creator: string;
  cover: string;
  episodes: CollectionShareEpisode[];
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const url = `${window.location.origin}/collection/${collectionId}/synthesis`;
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
  }, [collectionId, open]);

  const shown = episodes.slice(0, 6);
  const hasSemanticLabels = shown.length > 0 && shown.every((episode) => episode.label);
  const maxHeat = Math.max(...shown.map((episode) => episode.heat), 1);
  const hotIndexes = [...shown.keys()]
    .sort((left, right) => shown[right].heat - shown[left].heat)
    .slice(0, Math.min(2, shown.length));
  const episodeCovers = episodes.map((episode) => episode.cover).filter(Boolean).slice(0, 3) as string[];
  const meta = [creator, `${episodes.length} 集`].filter(Boolean).join(" · ");

  const onSave = async () => {
    if (busy || !cardRef.current) return;
    setBusy(true);
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(cardRef.current, {
        pixelRatio: 2.5,
        backgroundColor: "#faf9f6",
      });
      if (blob) triggerDownload(blob, `知音-合集-${name.slice(0, 20) || collectionId}.png`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="shareBtn" onClick={() => setOpen(true)} aria-haspopup="dialog">
        分享
      </button>

      {open && (
        <div
          className="shareOverlay"
          role="dialog"
          aria-modal="true"
          aria-label="合集分享卡片"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="shareSheet">
            <div className="scCard scCard--collection" ref={cardRef}>
              <ShareCardLogo />
              <div className="scCollectionKick">合集解析 · {episodes.length} 集</div>
              <h2 className="scHook scCollectionHook">{hook}</h2>

              {hasSemanticLabels && (
                <div className="scEpisodeChart">
                  <div className="scChartLab">各集讨论热度</div>
                  <div
                    className="scBars scEpisodeBars"
                    style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}
                  >
                    {shown.map((episode, index) => (
                      <div
                        className={`scBar${index === hotIndexes[0] ? " is-peak" : hotIndexes.includes(index) ? " is-hot" : ""}`}
                        key={`${episode.title}-${index}`}
                      >
                        <div
                          className="scCol"
                          style={{ height: `${Math.max(8, Math.round((episode.heat / maxHeat) * 100))}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div
                    className="scEpisodeLabels"
                    style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}
                  >
                    {shown.map((episode, index) => (
                      <span key={`${episode.label}-${index}`}>{episode.label}</span>
                    ))}
                  </div>
                  {episodes.length > shown.length && (
                    <div className="scEpisodeMore">另有 {episodes.length - shown.length} 集收入完整解析</div>
                  )}
                </div>
              )}

              <div className="scSrc scCollectionSrc">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 需要原生 img 供 html-to-image 内联截图
                  <img className="scCover scCollectionCover" src={cover} alt="" />
                ) : episodeCovers.length > 0 ? (
                  <div className="scCollectionCollage" aria-hidden="true">
                    {episodeCovers.map((episodeCover, index) => (
                      // eslint-disable-next-line @next/next/no-img-element -- 需要原生 img 供 html-to-image 内联截图
                      <img src={episodeCover} alt="" key={`${episodeCover}-${index}`} />
                    ))}
                  </div>
                ) : (
                  <div className="scCover scCollectionCover scCover--ph" aria-hidden="true" />
                )}
                <div className="scMeta">
                  <div className="scCollectionType">视频合集</div>
                  <div className="scTitle">{name}</div>
                  <div className="scBy">{meta}</div>
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
                  <div className="scCtaTitle">扫码查看完整合集解析</div>
                  <div className="scCtaSub">跨视频关系、补缺与回响，都在知音</div>
                </div>
              </div>
            </div>

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

function ShareCardLogo() {
  return (
    <svg className="scLogo" viewBox="0 0 100 52" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="知音">
      <path fill="#1c1a16" d="M25.5 5.6c4.4-.4 5.5 4.4 8.4 6.1 2.6 1.5 6.1.6 7.8 3.4 1.8 2.9-.7 5.8.6 8.7 1.5 3.2 4.8 5.2 3.7 8.8-1 3.3-4.8 3.6-6.2 6.7-1.5 3.4-2.9 6.8-6.9 7.2-3.7.4-5.7-3.1-9.1-3.8-3.5-.8-7.2.1-9.3-3.1-2.1-3.2.8-6.1-.1-9.6-.9-3.3-4.1-5.6-2.7-9 1.3-3.3 5.2-3.5 7.5-5.8 2.8-2.7 2.4-9.2 6.3-9.6Z" />
      <path fill="none" stroke="#1c1a16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.2" d="M75.3 8.4c4-.2 5.1 4.1 8.2 5.5 2.8 1.2 6.2 1.7 7 5 .9 3.3-2.2 5.5-1.4 8.8.8 3.2 3.1 6 .9 8.9-2.1 2.8-5.6 2.1-7.9 4.7-2.3 2.7-3.7 6.4-7.6 6.1-3.6-.2-4.8-4-7.8-5.6-3-1.7-6.9-1.8-7.8-5.3-.8-3.3 2.2-5.5 1.5-8.8-.6-3.1-3.6-5.5-2-8.6 1.6-3.2 5.5-2.9 8-5.4 2.5-2.4 5.2-5.1 8.9-5.3Z" />
      <path fill="none" stroke="#c89224" strokeLinecap="round" strokeWidth="2.7" d="M42.5 28.8Q53 38 65.3 28.7" />
      <circle cx="42.5" cy="28.8" r="4.6" fill="#faf9f6" />
      <circle cx="42.5" cy="28.8" r="3.1" fill="#c89224" />
      <circle cx="65.3" cy="28.7" r="3.1" fill="#c89224" />
    </svg>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
