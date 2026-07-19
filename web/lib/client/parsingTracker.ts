const STORAGE_KEY = "echoes:parsing:tracked:v1";

export type TrackedJobKind = "single" | "group";

export interface TrackedJob {
  kind: TrackedJobKind;
  id: string;
  addedAt: number;
}

function read(): TrackedJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TrackedJob[]) : [];
  } catch {
    return [];
  }
}

function write(jobs: TrackedJob[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    /* 隐私模式等场景存储不可用，后台跟踪静默失效，不影响解析本身 */
  }
}

/** 有新任务入列时广播——ParsingBadge 听到后立即刷新并弹开面板 */
export const PARSING_TRACKED_EVENT = "echoes:parsing-tracked";

export function trackParsingJob(kind: TrackedJobKind, id: string) {
  const jobs = read();
  if (!jobs.some((j) => j.kind === kind && j.id === id)) {
    write([...jobs, { kind, id, addedAt: Date.now() }]);
  }
  window.dispatchEvent(new Event(PARSING_TRACKED_EVENT));
}

/** 统一提交入口（首页输入条 / 右下角角标共用）：POST /api/parse 并入列跟踪。 */
export async function submitParse(input: string): Promise<{ kind: TrackedJobKind; id: string }> {
  const res = await fetch("/api/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });
  const data = (await res.json().catch(() => null)) as {
    error?: string;
    kind?: string;
    assetId?: string;
    groupId?: string;
  } | null;
  if (!res.ok) throw new Error(data?.error || `解析失败（${res.status}）`);
  const kind: TrackedJobKind = data?.kind === "single" ? "single" : "group";
  const id = (kind === "single" ? data?.assetId : data?.groupId) ?? "";
  if (!id) throw new Error("解析失败，稍后再试");
  trackParsingJob(kind, id);
  return { kind, id };
}

export function untrackParsingJob(kind: TrackedJobKind, id: string) {
  write(read().filter((j) => !(j.kind === kind && j.id === id)));
}

export function getTrackedJobs(): TrackedJob[] {
  return read();
}
