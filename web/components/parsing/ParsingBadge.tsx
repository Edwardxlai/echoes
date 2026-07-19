"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getTrackedJobs,
  submitParse,
  untrackParsingJob,
  PARSING_TRACKED_EVENT,
  type TrackedJob,
} from "@/lib/client/parsingTracker";

/* 全局后台解析角标：常驻根 layout，不随页面切换卸载，离开解析等待页
   也不打断轮询。跟踪列表存 localStorage，每 2.5s 用现成的
   /api/assets/:id、/api/groups/:id 刷新一遍——不新开数据源。
   空闲时也常驻：药丸变「＋ 接入」，面板顶部一行紧凑输入框，是首页
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
  const pathname = usePathname();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [open, setOpen] = useState(false);
  const [justDone, setJustDone] = useState<Set<string>>(new Set());
  const wasDone = useRef<Set<string>>(new Set());
  const tickRef = useRef<() => void>(() => {});
  const [draft, setDraft] = useState("");
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [intakeErr, setIntakeErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
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
      tickRef.current();
    };
    window.addEventListener(PARSING_TRACKED_EVENT, onTracked);
    return () => window.removeEventListener(PARSING_TRACKED_EVENT, onTracked);
  }, []);

  const submitIntake = async (event: FormEvent) => {
    event.preventDefault();
    if (intakeBusy) return;
    if (!/https?:\/\//.test(draft)) {
      setIntakeErr("先粘贴一条可识别的链接");
      return;
    }
    setIntakeBusy(true);
    setIntakeErr("");
    try {
      await submitParse(draft); // 入列即广播，上面的监听会刷新面板
      setDraft("");
    } catch (e) {
      setIntakeErr((e as Error).message || "接入失败，稍后再试");
    } finally {
      setIntakeBusy(false);
    }
  };

  const dismiss = (job: TrackedJob) => {
    untrackParsingJob(job.kind, job.id);
    setEntries((prev) => prev.filter((e) => !(e.job.kind === job.kind && e.job.id === job.id)));
  };

  if (pathname?.startsWith("/parsing")) return null;

  const anyPending = entries.some((e) => !entryDone(e));
  const stacked = /^\/collection\/[^/]+$/.test(pathname ?? "");

  return (
    <div className={`pbadge${stacked ? " pbadge--stacked" : ""}${open ? " open" : ""}`}>
      <div className="pbadge__dropdown">
        <form className="pbadge__intake" onSubmit={submitIntake}>
          <input
            type="text"
            inputMode="url"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (intakeErr) setIntakeErr("");
            }}
            placeholder="粘贴视频、合集或多条链接"
            aria-label="视频或合集链接"
            disabled={intakeBusy}
          />
          <button type="submit" disabled={intakeBusy}>
            {intakeBusy ? "接入中…" : "接入 →"}
          </button>
        </form>
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
        className="pbadge__pill"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {entries.length === 0 ? (
          <>
            <span className="pbadge__plus" aria-hidden="true">＋</span>
            <span className="pbadge__label">接入</span>
          </>
        ) : (
          <>
            <span className={`pbadge__dot${anyPending ? " pbadge__dot--pulse" : ""}`} aria-hidden="true" />
            <span className="pbadge__label">{anyPending ? "解析中" : "已完成"}</span>
            <span className="pbadge__count">{entries.length}</span>
          </>
        )}
        <span className="pbadge__caret" aria-hidden="true">▾</span>
      </button>
    </div>
  );
}
