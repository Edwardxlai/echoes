"use client";

import { useEffect, useId, useRef, useState } from "react";
import { submitParse } from "@/lib/client/parsingTracker";

/* 统一输入口（PRD §6.4.1）：单条视频 / 现成合集 / 多条独立链接。
   识别在服务端做（短链展开后才知道是不是合集）：POST /api/parse 建资产并
   后台跑管线。提交后不跳页——入列跟踪即广播，右下角角标自动弹开
   亮出新任务行；解析等待页降级为详情页，从角标任务行点进。

   右侧另有独立「搜索」切换钮（显式入口，omnibox 方案已否）：点亮进入
   搜索模式，在已解析内容里实时检索（标题/作者/核心问题/合集名），
   结果按区域分组、点击直达视频页；搜索模式里粘贴链接自动切回解析，
   不设模式墙。 */

type InputState = "idle" | "submitting" | "done" | "error";
type Mode = "parse" | "search";

interface SearchHit {
  id: string;
  title: string;
  author: string;
  coreQuestion: string;
  categoryId: string | null;
  collectionName: string;
}

const REGION_NAME: Record<string, string> = {
  eco: "经济区域",
  his: "历史区域",
  tech: "科技区域",
  unknown: "未知海域",
};
const REGION_ORDER = ["eco", "his", "tech", "unknown"];

const isLink = (v: string) => /https?:\/\//.test(v);

function Highlight({ text, query }: { text: string; query: string }) {
  const i = query ? text.indexOf(query) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{query}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

export function HeroInput({ compact = false }: { compact?: boolean }) {
  const inputId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoParseRef = useRef(false);
  const [mode, setMode] = useState<Mode>("parse");
  const [value, setValue] = useState("");
  const [state, setState] = useState<InputState>("idle");
  const [error, setError] = useState("");
  /** 自动回切等一次性提示；输入变化即清 */
  const [notice, setNotice] = useState("");
  /** null = 尚未搜索（无下拉）；[] = 搜过但没命中 */
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [dedupe, setDedupe] = useState(true);
  const [doneMessage, setDoneMessage] = useState("已提交解析，右下角可查看进度");

  const query = value.trim();

  useEffect(() => {
    // 清空结果由事件源头负责（onChange/切换/Esc），effect 只管取数
    if (mode !== "search" || !query || isLink(query)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { hits?: SearchHit[] };
        setHits(Array.isArray(data?.hits) ? data.hits : []);
        setSearching(false);
      } catch {
        /* 中止（新输入接管）或网络错：保持现状不闪 */
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [mode, query]);

  const submit = async () => {
    if (mode === "search") return; // 搜索是实时的，回车不需要动作
    if (state === "submitting") return;
    if (!isLink(value)) {
      setState("error");
      setError("先粘贴一条可识别的链接，或点右侧按钮切换到搜索模式");
      return;
    }
    runParse(value);
  };

  const runParse = async (target: string, opts?: { overwrite?: boolean }) => {
    setState("submitting");
    setError("");
    try {
      const r = await submitParse(target, { dedupe, overwrite: opts?.overwrite });
      setValue("");
      setDoneMessage(
        "needsConfirm" in r || "needsDuplicateConfirm" in r
          ? "已加入解析队列，右下角有一项需要确认"
          : "已提交解析，右下角可查看进度",
      );
      setState("done");
    } catch (e) {
      setState("error");
      setError((e as Error).message || "解析失败，稍后再试");
    }
  };

  useEffect(() => {
    if (autoParseRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const target = params.get("parse")?.trim() ?? "";
    if (params.get("autostart") !== "1" || !isLink(target)) return;

    autoParseRef.current = true;
    setMode("parse");
    setValue(target);
    void runParse(target, { overwrite: true });
    window.history.replaceState(null, "", window.location.pathname);
    // This intentionally runs once on arrival from the Douyin demo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMode = () => {
    setNotice("");
    setState("idle");
    setError("");
    if (mode === "parse") {
      // 带着链接进搜索没有意义，清掉；带着关键词进搜索则立即出结果
      if (isLink(value)) setValue("");
      setMode("search");
    } else {
      setMode("parse");
      setHits(null);
    }
    inputRef.current?.focus();
  };

  const onChange = (next: string) => {
    setValue(next);
    setNotice("");
    if (state !== "idle") {
      setState("idle");
      setError("");
    }
    if (mode === "search") {
      // 搜索模式里粘贴链接：自动切回解析，用户不会被模式墙挡住
      if (isLink(next)) {
        setMode("parse");
        setHits(null);
        setNotice("识别到链接，已自动切回解析模式");
      } else if (!next.trim()) {
        setHits(null);
      }
    }
  };

  const grouped = REGION_ORDER.flatMap((region) => {
    const items = (hits ?? []).filter(
      (hit) => (hit.categoryId && REGION_NAME[hit.categoryId] ? hit.categoryId : "unknown") === region
    );
    return items.length ? [{ region, items }] : [];
  });

  return (
    <div className={`mapInputBlock${compact ? " mapInputBlock--compact" : ""}`}>
      <div
        className="mapInputLine"
        onBlur={(event) => {
          // 焦点离开整个输入区（含下拉）才收起结果，点结果链接不受影响
          if (!event.currentTarget.contains(event.relatedTarget)) setHits(null);
        }}
      >
        <div className="mapInputAnchor">
          <form
            className={`mapInputRow${state === "error" ? " has-error" : ""}`}
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label className="srOnly" htmlFor={inputId}>
              {mode === "search" ? "搜索已解析的视频" : "视频或合集链接"}
            </label>
            {!compact && (
              <span className="mapInputRow__icon" aria-hidden="true">
                ↗
              </span>
            )}
            <textarea
              ref={inputRef}
              id={inputId}
              rows={1}
              inputMode={mode === "search" ? "text" : "url"}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && mode === "search") {
                  setValue("");
                  setHits(null);
                }
                if (event.key === "Enter" && !event.shiftKey && mode === "parse") {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={
                mode === "search" ? "搜索已解析的视频…" : "粘贴视频、合集，或每行粘贴一条链接"
              }
              aria-describedby={`${inputId}-note`}
              aria-invalid={state === "error"}
              disabled={state === "submitting"}
            />
            <button type="submit" disabled={state === "submitting" || mode === "search"}>
              {mode === "search" ? "搜索" : state === "submitting" ? "解析中…" : "开始解析"}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          {mode === "search" && hits !== null && (
            <div className="mapSearchDrop" aria-label="搜索结果">
              {hits.length === 0 ? (
                <div className="mapSearchDrop__empty">
                  没有命中「{query}」——切回解析模式可以把它解析进来
                </div>
              ) : (
                grouped.map(({ region, items }) => (
                  <div className="mapSearchDrop__group" key={region}>
                    <div className="mapSearchDrop__region">
                      <i className={`mapSearchDrop__dot mapSearchDrop__dot--${region}`} aria-hidden="true" />
                      {REGION_NAME[region]}
                    </div>
                    {items.map((hit) => (
                      <a className="mapSearchHit" href={`/video/${hit.id}`} key={hit.id}>
                        <b>
                          <Highlight text={hit.title} query={query} />
                        </b>
                        {hit.collectionName && <span>{hit.collectionName}</span>}
                      </a>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          className="mapModeBtn"
          aria-pressed={mode === "search"}
          onClick={toggleMode}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.4" />
            <line x1="10.4" y1="10.4" x2="14" y2="14" />
          </svg>
          搜索
        </button>
      </div>
      <div className="mapInputMeta" id={`${inputId}-note`} aria-live="polite">
          <>
        {state === "error" && <span className="mapInputMeta__error">{error}</span>}
        {state === "submitting" && (
          <span className="mapInputMeta__pending">正在识别链接…合集需要十几秒枚举</span>
        )}
        {state === "done" && (
          <span className="mapInputMeta__success">{doneMessage}</span>
        )}
        {state === "idle" && notice && <span className="mapInputMeta__success">{notice}</span>}
        {state === "idle" && !notice && mode === "search" && (
          <span className="mapInputMeta__mode">
            {searching ? "搜索中…" : "搜索模式 · 输入关键词，点击结果直达视频页 · 再点右侧按钮返回解析"}
          </span>
        )}
        {state === "idle" && !notice && mode === "parse" && compact && (
          <span className="mapInputMeta__mode">支持抖音单条视频 / 现成合集 · 点击右侧按钮切换到搜索模式</span>
        )}
        {state === "idle" && !notice && mode === "parse" && !compact && (
          <>
            <span className="mapInputMeta__mode">支持抖音单条视频 / 现成合集 / 自定义视频组</span>
            <span className="mapInputMeta__sample">试用示例 ↗</span>
          </>
        )}
        {mode === "parse" && (
          <label className="mapDedupeSwitch">
            <input
              type="checkbox"
              role="switch"
              checked={dedupe}
              disabled={state === "submitting"}
              onChange={(event) => setDedupe(event.target.checked)}
            />
            <span aria-hidden="true" />
            去重模式
          </label>
        )}
          </>
      </div>
    </div>
  );
}
