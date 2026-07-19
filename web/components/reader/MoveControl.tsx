"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* 解析页「移动」：归错了的低频修正入口，与「查看原视频」同级同色。
   两级面板——第一级选大陆（三大陆可下钻 + 未知海域直接落点），
   第二级选合集（散篇集置顶为默认位，tc- 主题合集可直选）。
   无确认弹窗，选中即 POST /api/assets/:id/move，成功后刷新本页。 */

export interface MoveTargetCategory {
  id: string;
  name: string;
  collections: { id: string; name: string; misc: boolean }[];
}

export function MoveControl({
  assetId,
  currentCategoryId,
  currentCollectionId,
  targets,
}: {
  assetId: string;
  /** 三大陆之一；未知海域（soc/sci/none）为 null */
  currentCategoryId: string | null;
  currentCollectionId: string | null;
  targets: MoveTargetCategory[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLSpanElement>(null);

  const close = () => {
    setOpen(false);
    setLevel(null);
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

  const move = async (payload: { categoryId?: string; collectionId?: string; sea?: boolean }) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/assets/${assetId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data as { error?: string })?.error || `移动失败（${res.status}）`);
      close();
      router.refresh();
    } catch (e) {
      setError((e as Error).message || "移动失败，稍后再试");
    } finally {
      setBusy(false);
    }
  };

  const cat = level ? targets.find((t) => t.id === level) : undefined;

  return (
    <span className="moveCtl" ref={rootRef}>
      <button
        type="button"
        className="moveBtn"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => (open ? close() : setOpen(true))}
      >
        移动
      </button>
      {open && (
        <span className="movePick" role="menu">
          {!cat ? (
            <>
              <span className="movePick__head">移到哪片大陆</span>
              {targets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="menuitem"
                  className="movePick__item"
                  disabled={busy}
                  onClick={() => setLevel(t.id)}
                >
                  <span>{t.name}</span>
                  <span className="movePick__mark">{t.id === currentCategoryId ? "当前 ›" : "›"}</span>
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                className="movePick__item movePick__item--sea"
                disabled={busy || currentCategoryId === null}
                onClick={() => move({ sea: true })}
              >
                <span>未知海域</span>
                {currentCategoryId === null && <span className="movePick__mark">当前</span>}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="movePick__head movePick__head--back"
                onClick={() => setLevel(null)}
              >
                ← {cat.name} · 选合集
              </button>
              {cat.collections.map((c) => {
                const isCur = c.id === currentCollectionId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="menuitem"
                    className="movePick__item"
                    disabled={busy || isCur}
                    onClick={() => move(c.misc ? { categoryId: cat.id } : { collectionId: c.id })}
                  >
                    <span>{c.name}</span>
                    <span className="movePick__mark">
                      {isCur ? "当前" : c.misc ? "默认 · 自动聚类" : ""}
                    </span>
                  </button>
                );
              })}
            </>
          )}
          {error && <span className="movePick__err">{error}</span>}
        </span>
      )}
    </span>
  );
}
