import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { getAsset, updateAsset, type SourceAsset } from "./store";

const execFileAsync = promisify(execFile);
const TMP = join(process.cwd(), ".tmp");

export interface EngagementMetrics {
  likeCount: number;
  collectCount: number;
  commentCount: number;
  shareCount: number;
  metricsSource: "real" | "mock";
  metricsFetchedAt: string;
}

export function engagementHeatOf(asset: Pick<SourceAsset, "commentCount">): number {
  return Math.max(0, Number(asset.commentCount) || 0);
}

function hash32(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mockEngagement(seed: string): EngagementMetrics {
  const hash = hash32(seed);
  const likeCount = 1800 + (hash % 48200);
  const collectRate = 0.08 + ((hash >>> 8) % 23) / 100;
  return {
    likeCount,
    collectCount: Math.round(likeCount * collectRate),
    commentCount: Math.round(likeCount * (0.012 + ((hash >>> 16) % 35) / 1000)),
    shareCount: Math.round(likeCount * (0.02 + ((hash >>> 24) % 40) / 1000)),
    metricsSource: "mock",
    metricsFetchedAt: new Date().toISOString(),
  };
}

function awemeIdFromUrl(url: string): string | null {
  return url.match(/\/(?:share\/)?video\/(\d+)/)?.[1] ?? null;
}

async function fetchRealEngagement(awemeId: string): Promise<EngagementMetrics> {
  await mkdir(TMP, { recursive: true });
  const out = join(TMP, `engagement_${awemeId}_${randomUUID().slice(0, 8)}.json`);
  const script = join(process.cwd(), "..", "scripts", "engagement_metrics.py");
  try {
    await execFileAsync("python", [script, awemeId, out], {
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      timeout: 45000,
      maxBuffer: 1024 * 1024,
    }).catch(() => undefined);
    const payload = JSON.parse(await readFile(out, "utf8")) as Record<string, unknown>;
    if (!payload.ok) throw new Error(String(payload.error || "fetch failed"));
    const likeCount = Number(payload.like_count);
    const collectCount = Number(payload.collect_count);
    if (![likeCount, collectCount].every(Number.isFinite)) throw new Error("invalid counters");
    return {
      likeCount: Math.max(0, likeCount),
      collectCount: Math.max(0, collectCount),
      commentCount: Math.max(0, Number(payload.comment_count) || 0),
      shareCount: Math.max(0, Number(payload.share_count) || 0),
      metricsSource: "real",
      metricsFetchedAt: new Date().toISOString(),
    };
  } finally {
    await unlink(out).catch(() => undefined);
  }
}

export async function refreshAssetEngagement(assetId: string): Promise<EngagementMetrics> {
  const asset = getAsset(assetId);
  if (!asset) throw new Error(`asset not found: ${assetId}`);
  const awemeId = awemeIdFromUrl(asset.sourceUrl);
  let metrics: EngagementMetrics;
  try {
    metrics = awemeId ? await fetchRealEngagement(awemeId) : mockEngagement(asset.id);
  } catch {
    metrics = mockEngagement(awemeId || asset.id);
  }
  updateAsset(asset.id, metrics);
  return metrics;
}

export async function ensureAssetEngagement(assetId: string): Promise<EngagementMetrics> {
  const asset = getAsset(assetId);
  if (!asset) throw new Error(`asset not found: ${assetId}`);
  if (asset.metricsSource && asset.likeCount != null && asset.collectCount != null && asset.commentCount != null) {
    return {
      likeCount: asset.likeCount,
      collectCount: asset.collectCount,
      commentCount: asset.commentCount ?? 0,
      shareCount: asset.shareCount ?? 0,
      metricsSource: asset.metricsSource,
      metricsFetchedAt: asset.metricsFetchedAt,
    };
  }
  return refreshAssetEngagement(assetId);
}
