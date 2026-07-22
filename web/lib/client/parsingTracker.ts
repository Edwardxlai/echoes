const STORAGE_KEY = "echoes:parsing:tracked:v1";
const PENDING_KEY = "echoes:parsing:pending:v1";

export type TrackedJobKind = "single" | "group";

export interface TrackedJob {
  kind: TrackedJobKind;
  id: string;
  addedAt: number;
}

export type PendingDecision =
  | {
      id: string;
      type: "mix";
      input: string;
      mixName: string;
      mixUrl: string;
      dedupe: boolean;
      addedAt: number;
    }
  | {
      id: string;
      type: "duplicate";
      input: string;
      duplicateCount: number;
      existingId: string;
      existingTitle: string;
      forceSingle: boolean;
      dedupe: boolean;
      addedAt: number;
    };

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

function readPending(): PendingDecision[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingDecision[]) : [];
  } catch {
    return [];
  }
}

function writePending(items: PendingDecision[]) {
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(items));
  } catch {
    /* 与解析任务跟踪一致，存储不可用时不阻塞实际解析 */
  }
}

/** 有新任务入列时广播——ParsingBadge 听到后立即刷新并弹开面板 */
export const PARSING_TRACKED_EVENT = "echoes:parsing-tracked";

function pendingId(input: string, requested?: string): string {
  if (requested) return requested;
  return readPending().find((item) => item.input === input)?.id
    ?? `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function queuePendingDecision(item: PendingDecision) {
  const rest = readPending().filter((pending) => pending.id !== item.id);
  writePending([...rest, item]);
  window.dispatchEvent(new Event(PARSING_TRACKED_EVENT));
}

export function trackParsingJob(kind: TrackedJobKind, id: string) {
  const jobs = read();
  if (!jobs.some((j) => j.kind === kind && j.id === id)) {
    write([...jobs, { kind, id, addedAt: Date.now() }]);
  }
  window.dispatchEvent(new Event(PARSING_TRACKED_EVENT));
}

/** 提交结果：已入列的任务，或「这条属于某合集」待用户拍板（不入列）。 */
export type SubmitResult =
  | { kind: TrackedJobKind; id: string }
  | { needsConfirm: true; pendingId: string; mixName: string; mixUrl: string }
  | { needsDuplicateConfirm: true; pendingId: string; duplicateCount: number; existingId: string; existingTitle: string };

/** 统一提交入口（首页输入条 / 右下角角标共用）：POST /api/parse 并入列跟踪。
    forceSingle：用户在合集确认里选了「只解析这条」，跳过合集反查。 */
export async function submitParse(
  input: string,
  opts?: { forceSingle?: boolean; dedupe?: boolean; overwrite?: boolean; pendingId?: string },
): Promise<SubmitResult> {
  const res = await fetch("/api/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input,
      dedupe: opts?.dedupe !== false,
      ...(opts?.forceSingle ? { forceSingle: true } : {}),
      ...(opts?.overwrite ? { overwrite: true } : {}),
    }),
  });
  const data = (await res.json().catch(() => null)) as {
    error?: string;
    kind?: string;
    assetId?: string;
    groupId?: string;
    mixName?: string;
    mixUrl?: string;
    duplicateCount?: number;
    existingId?: string;
    existingTitle?: string;
  } | null;
  if (!res.ok) throw new Error(data?.error || `解析失败（${res.status}）`);
  if (data?.kind === "confirm-mix") {
    const id = pendingId(input, opts?.pendingId);
    queuePendingDecision({
      id,
      type: "mix",
      input,
      mixName: data.mixName || "",
      mixUrl: data.mixUrl || "",
      dedupe: opts?.dedupe !== false,
      addedAt: Date.now(),
    });
    return { needsConfirm: true, pendingId: id, mixName: data.mixName || "", mixUrl: data.mixUrl || "" };
  }
  if (data?.kind === "confirm-duplicate") {
    const id = pendingId(input, opts?.pendingId);
    queuePendingDecision({
      id,
      type: "duplicate",
      input,
      duplicateCount: data.duplicateCount || 1,
      existingId: data.existingId || "",
      existingTitle: data.existingTitle || "",
      forceSingle: !!opts?.forceSingle,
      dedupe: opts?.dedupe !== false,
      addedAt: Date.now(),
    });
    return {
      needsDuplicateConfirm: true,
      pendingId: id,
      duplicateCount: data.duplicateCount || 1,
      existingId: data.existingId || "",
      existingTitle: data.existingTitle || "",
    };
  }
  const kind: TrackedJobKind = data?.kind === "single" ? "single" : "group";
  const id = (kind === "single" ? data?.assetId : data?.groupId) ?? "";
  if (!id) throw new Error("解析失败，稍后再试");
  if (opts?.pendingId) removePendingDecision(opts.pendingId, false);
  trackParsingJob(kind, id);
  return { kind, id };
}

export function untrackParsingJob(kind: TrackedJobKind, id: string) {
  write(read().filter((j) => !(j.kind === kind && j.id === id)));
}

export function getTrackedJobs(): TrackedJob[] {
  return read();
}

export function getPendingDecisions(): PendingDecision[] {
  return readPending();
}

export function removePendingDecision(id: string, announce = true) {
  writePending(readPending().filter((item) => item.id !== id));
  if (announce) window.dispatchEvent(new Event(PARSING_TRACKED_EVENT));
}
