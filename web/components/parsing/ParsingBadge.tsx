"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  getTrackedJobs,
  getPendingDecisions,
  removePendingDecision,
  submitParse,
  untrackParsingJob,
  PARSING_TRACKED_EVENT,
  type TrackedJob,
  type PendingDecision,
} from "@/lib/client/parsingTracker";

/* 全局后台解析角标：常驻根 layout，不随页面切换卸载，离开解析等待页
   也不打断轮询。跟踪列表存 localStorage，每 2.5s 用现成的
   /api/assets/:id、/api/groups/:id 刷新一遍——不新开数据源。
   空闲时也常驻：药丸变「＋ 解析」，面板顶部一行紧凑输入框，是首页
   输入条之外唯一的粘贴入口；提交不跳页，任务行直接落在面板里。 */

interface SingleData {
  status: "uploaded" | "transcribing" | "analyzing" | "analyzed" | "failed";
  step: string;
  title: string;
  errorMessage: string;
}

interface GroupAsset {
  id: string;
  status: SingleData["status"];
  step: string;
  title: string;
}

interface Entry {
  job: TrackedJob;
  single?: SingleData;
  group?: { assets: GroupAsset[] };
}

const POLL_MS = 2500;
const FLASH_MS = 1200;

function isSettled(status: SingleData["status"]) {
  return status === "analyzed" || status === "failed";
}

function singleStatusText(d: SingleData) {
  if (d.status === "analyzed") return "✓ 已完成";
  if (d.status === "failed") return "✗ 失败";
  return d.step || "排队中";
}

function entryDone(e: Entry): boolean {
  if (e.single) return isSettled(e.single.status);
  if (e.group) return e.group.assets.every((a) => isSettled(a.status));
  return false;
}

export function ParsingBadge() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [open, setOpen] = useState(false);
  const [justDone, setJustDone] = useState<Set<string>>(new Set());
  const wasDone = useRef<Set<string>>(new Set());
  const tickRef = useRef<() => void>(() => {});
  const [draft, setDraft] = useState("");
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [intakeErr, setIntakeErr] = useState("");
  const [dedupe, setDedupe] = useState(true);
  const [pendingDecisions, setPendingDecisions] = useState<PendingDecision[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (!cancelled) setPendingDecisions(getPendingDecisions());
      const jobs = getTrackedJobs();
      if (jobs.length === 0) {
        if (!cancelled) setEntries([]);
        return;
      }

      const results = await Promise.all(
        jobs.map(async (job): Promise<Entry | null> => {
          try {
            if (job.kind === "single") {
              const res = await fetch(`/api/assets/${job.id}`);
              if (res.status === 404) {
                untrackParsingJob(job.kind, job.id);
                return null;
              }
              return { job, single: (await res.json()) as SingleData };
            }
            const res = await fetch(`/api/groups/${job.id}`);
            if (res.status === 404) {
              untrackParsingJob(job.kind, job.id);
              return null;
            }
            return { job, group: (await res.json()) as { assets: GroupAsset[] } };
          } catch {
            return { job };
          }
        })
      );

      if (cancelled) return;
      const next = results.filter((e): e is Entry => e !== null);

      const nowDone = new Set<string>();
      for (const e of next) {
        const key = `${e.job.kind}:${e.job.id}`;
        if (entryDone(e)) {
          nowDone.add(key);
          if (!wasDone.current.has(key)) {
            setJustDone((prev) => new Set(prev).add(key));
            setTimeout(() => {
              setJustDone((prev) => {
                const copy = new Set(prev);
                copy.delete(key);
                return copy;
              });
            }, FLASH_MS);
          }
        }
      }
      wasDone.current = nowDone;
      setEntries(next);
    };

    tickRef.current = tick;
    tick();
    const t = setInterval(() => {
      if (!cancelled) tick();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // 首页输入条等外部入口提交后：立即刷新并弹开面板，让新任务行可见
  useEffect(() => {
    const onTracked = () => {
      setOpen(true);
      setPendingDecisions(getPendingDecisions());
      tickRef.current();
    };
    window.addEventListener(PARSING_TRACKED_EVENT, onTracked);
    return () => window.removeEventListener(PARSING_TRACKED_EVENT, onTracked);
  }, []);

  const submitIntake = (event: FormEvent) => {
    event.preventDefault();
    if (!/https?:\/\//.test(draft)) {
      setIntakeErr("先粘贴一条可识别的链接");
      return;
    }
    runIntake(draft);
  };

  const runIntake = async (target: string) => {
    if (intakeBusy) return;
    setIntakeBusy(true);
    setIntakeErr("");
    try {
      await submitParse(target, { dedupe }); // 待确认项也会持久入列并广播
      setDraft("");
    } catch (e) {
      setIntakeErr((e as Error).message || "解析失败，稍后再试");
    } finally {
      setIntakeBusy(false);
    }
  };

  const resolvePending = async (item: PendingDecision, action: "all" | "single" | "overwrite") => {
    if (resolvingId) return;
    setResolvingId(item.id);
    setIntakeErr("");
    try {
      const input = item.type === "mix" && action === "all" ? item.mixUrl : item.input;
      await submitParse(input, {
        pendingId: item.id,
        dedupe: item.dedupe,
        forceSingle: action === "single" || (item.type === "duplicate" && item.forceSingle),
        overwrite: action === "overwrite",
      });
      setPendingDecisions(getPendingDecisions());
    } catch (e) {
      setIntakeErr((e as Error).message || "处理失败，稍后再试");
    } finally {
      setResolvingId(null);
    }
  };

  const dismiss = (job: TrackedJob) => {
    untrackParsingJob(job.kind, job.id);
    setEntries((prev) => prev.filter((e) => !(e.job.kind === job.kind && e.job.id === job.id)));
  };

  const anyPending = entries.some((e) => !entryDone(e));
  const needsAttention = pendingDecisions.length > 0;
  const totalItems = entries.length + pendingDecisions.length;

  return (
    <div className={`pbadge${open ? " open" : ""}`}>
      <div className="pbadge__dropdown">
        <form className="pbadge__intake" onSubmit={submitIntake}>
          <textarea
            rows={2}
            inputMode="url"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (intakeErr) setIntakeErr("");
            }}
            placeholder="粘贴视频、合集，或每行一条链接"
            aria-label="视频或合集链接"
            disabled={intakeBusy}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button type="submit" disabled={intakeBusy}>
            {intakeBusy ? "解析中…" : "解析 →"}
          </button>
        </form>
        <label className="pbadge__dedupe">
          <input
            type="checkbox"
            role="switch"
            checked={dedupe}
            disabled={intakeBusy}
            onChange={(event) => {
              setDedupe(event.target.checked);
            }}
          />
          <span aria-hidden="true" />
          <b>去重模式</b>
          <small>{dedupe ? "重复内容先确认再覆盖" : "允许保留重复内容"}</small>
        </label>
        {pendingDecisions.map((item) => (
          <section className={`pbadge__decision pbadge__decision--${item.type}`} aria-live="polite" key={item.id}>
            <span className="pbadge__decisionFlag">需要确认</span>
            <span className="pbadge__decisionKind">{item.type === "mix" ? "检测到所属合集" : "发现重复内容"}</span>
            <strong>
              {item.type === "mix"
                ? `《${item.mixName || "未命名合集"}》`
                : `《${item.existingTitle || "未命名视频"}》`}
            </strong>
            <p>
              {item.type === "mix"
                ? "请选择本次解析范围。"
                : `这条视频已经解析过${item.duplicateCount > 1 ? `，本次输入共有 ${item.duplicateCount} 条重复` : ""}，旧结果尚未改动。`}
            </p>
            <div className="pbadge__decisionBtns">
              {item.type === "mix" ? (
                <>
                  <button type="button" className="is-primary" disabled={!!resolvingId} onClick={() => resolvePending(item, "all")}>解析整个合集</button>
                  <button type="button" disabled={!!resolvingId} onClick={() => resolvePending(item, "single")}>只解析这条</button>
                </>
              ) : (
                <>
                  <button type="button" className="is-danger" disabled={!!resolvingId} onClick={() => resolvePending(item, "overwrite")}>确认覆盖</button>
                  <button
                    type="button"
                    disabled={!!resolvingId}
                    onClick={() => {
                      removePendingDecision(item.id);
                      setPendingDecisions(getPendingDecisions());
                    }}
                  >
                    保留旧内容
                  </button>
                </>
              )}
            </div>
          </section>
        ))}
        {intakeErr && <span className="pbadge__intakeErr">{intakeErr}</span>}
        {entries.map((e) => {
          const key = `${e.job.kind}:${e.job.id}`;
          const done = entryDone(e);
          const flash = justDone.has(key);

          if (e.job.kind === "single") {
            const d = e.single;
            const title = d?.title || "解析中的视频";
            const status = d ? singleStatusText(d) : "连接中…";
            const row = (
              <>
                <span className="pbadge__rtitle">《{title}》</span>
                <span className="pbadge__rmeta">
                  <span className={!done ? "pbadge__step" : undefined}>
                    {!done && <span className="pbadge__stepdot" aria-hidden="true" />}
                    {status}
                  </span>
                  {done && <span className="pbadge__rgo">查看 →</span>}
                </span>
              </>
            );
            return done && d?.status === "analyzed" ? (
              <Link
                key={key}
                className={`pbadge__row pbadge__row--done${flash ? " pbadge__row--flash" : ""}`}
                href={`/video/${e.job.id}`}
                onClick={() => untrackParsingJob(e.job.kind, e.job.id)}
              >
                {row}
              </Link>
            ) : (
              <div key={key} className={`pbadge__row${done ? " pbadge__row--failed" : ""}`}>
                <Link
                  className="pbadge__rowlink"
                  href={`/parsing/${e.job.id}`}
                  aria-label={`查看《${title}》的解析进度`}
                >
                  {row}
                </Link>
                <button
                  type="button"
                  className="pbadge__dismiss"
                  aria-label="移出列表"
                  onClick={() => dismiss(e.job)}
                >
                  ×
                </button>
              </div>
            );
          }

          const assets = e.group?.assets ?? [];
          const total = assets.length;
          const doneCount = assets.filter((a) => isSettled(a.status)).length;
          const firstTitled = assets.find((a) => a.title)?.title;
          const title = firstTitled
            ? total > 1
              ? `${firstTitled} 等 ${total} 条`
              : firstTitled
            : `${total || "…"} 条视频`;
          const meta = total ? `${doneCount}/${total}${done ? " 已完成" : ""}` : "连接中…";
          const row = (
            <>
              <span className="pbadge__rtitle">{title}</span>
              <span className="pbadge__rmeta">
                <span>{meta}</span>
                {done && <span className="pbadge__rgo">查看 →</span>}
              </span>
            </>
          );
          return done ? (
            <Link
              key={key}
              className={`pbadge__row pbadge__row--done${flash ? " pbadge__row--flash" : ""}`}
              href={`/parsing/group/${e.job.id}`}
              onClick={() => untrackParsingJob(e.job.kind, e.job.id)}
            >
              {row}
            </Link>
          ) : (
            <div key={key} className="pbadge__row">
              <Link
                className="pbadge__rowlink"
                href={`/parsing/group/${e.job.id}`}
                aria-label={`查看${title}的解析进度`}
              >
                {row}
              </Link>
              <button
                type="button"
                className="pbadge__dismiss"
                aria-label="移出列表"
                onClick={() => dismiss(e.job)}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className={`pbadge__pill${needsAttention ? " pbadge__pill--warning" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {totalItems === 0 ? (
          <>
            <span className="pbadge__plus" aria-hidden="true">＋</span>
            <span className="pbadge__label">解析</span>
          </>
        ) : (
          <>
            <span className={`pbadge__dot${anyPending || needsAttention ? " pbadge__dot--pulse" : ""}`} aria-hidden="true" />
            <span className="pbadge__label">{needsAttention ? "待确认" : anyPending ? "解析中" : "已完成"}</span>
            <span className="pbadge__count">{totalItems}</span>
          </>
        )}
        <span className="pbadge__caret" aria-hidden="true">▾</span>
      </button>
    </div>
  );
}
