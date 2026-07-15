/* ================================================================
   回响 · 服务端存储（PRD §8，node:sqlite 零依赖）
   source_assets / transcripts / analyses / collections。
   M3/M4 起：bigCategoryId 由 L3 分类回填，echoes 由 L5 匹配回填，
   collections 承接 mix 组与各大类"散篇"合集（真实数据上地图）。
   只允许从 Route Handler / Server Component 导入。
   ================================================================ */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { CognitiveExpansion, Echo } from "@/lib/data";

export type AssetStatus =
  | "uploaded"
  | "transcribing"
  | "analyzing"
  | "analyzed"
  | "failed";

export interface SourceAsset {
  id: string;
  type: string;
  title: string;
  author: string;
  sourceUrl: string;
  sourcePlatform: string;
  status: AssetStatus;
  step: string; // 当前步骤名，供解析等待页展示
  errorMessage: string;
  duration: string; // "mm:ss"，探不到为空
  cover: string; // 本地封面路径（/covers/real/xx.jpg），抓不到为空
  groupId: string | null;
  bigCategoryId: string | null;
  collectionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackboneNode {
  id: string;
  concept: string;
  /** 该节点在所选骨架中的环节名（≤4字，如"核心张力"/"论据"）。旧数据缺席，前端回落时间戳。 */
  role?: string;
  detail: string;
  timestamp: string;
}

export interface Analysis {
  assetId: string;
  coreQuestion: string;
  videoType: string;
  typeConfidence: number;
  summary: string;
  backbone: BackboneNode[];
  takeaways: string[];
  /** L4 认知拓展（M3 起 known 由观看史检索填充）。生成失败时缺席，解析页不摆空壳。 */
  cognitiveExpansion?: CognitiveExpansion;
  /** L5 回响：按 backbone 下标挂到节点。宁缺毋滥，没有就是空数组。 */
  echoes?: StoredEcho[];
}

/** 落库的回响：nodeIndex 定位本条 backbone 的节点，其余字段即前端 Echo。 */
export interface StoredEcho extends Echo {
  nodeIndex: number;
}

export interface CollectionRow {
  id: string;
  name: string;
  categoryId: string;
  createdAt: string;
}

const DATA_DIR = join(process.cwd(), "data");

let db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (db) return db;
  mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(join(DATA_DIR, "echoes.db"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS source_assets (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'video',
      title TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT '',
      sourceUrl TEXT NOT NULL,
      sourcePlatform TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'uploaded',
      step TEXT NOT NULL DEFAULT '',
      errorMessage TEXT NOT NULL DEFAULT '',
      duration TEXT NOT NULL DEFAULT '',
      groupId TEXT,
      bigCategoryId TEXT,
      collectionId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transcripts (
      id TEXT PRIMARY KEY,
      assetId TEXT NOT NULL,
      fullText TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      assetId TEXT NOT NULL UNIQUE,
      coreQuestion TEXT NOT NULL DEFAULT '',
      videoType TEXT NOT NULL DEFAULT '',
      typeConfidence REAL NOT NULL DEFAULT 0,
      summary TEXT NOT NULL DEFAULT '',
      backbone TEXT NOT NULL DEFAULT '[]',
      takeaways TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      categoryId TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);
  // 增量迁移（列已存在时静默跳过）：M2 认知拓展；M3 回响；封面
  for (const sql of [
    `ALTER TABLE analyses ADD COLUMN cognitiveExpansion TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE analyses ADD COLUMN echoes TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE source_assets ADD COLUMN cover TEXT NOT NULL DEFAULT ''`,
  ]) {
    try { db.exec(sql); } catch { /* 列已存在 */ }
  }
  return db;
}

const now = () => new Date().toISOString();

export function createAsset(input: {
  sourceUrl: string;
  sourcePlatform?: string;
  title?: string;
  groupId?: string | null;
}): SourceAsset {
  const asset: SourceAsset = {
    id: randomUUID().slice(0, 8),
    type: "video",
    title: input.title ?? "",
    author: "",
    sourceUrl: input.sourceUrl,
    sourcePlatform: input.sourcePlatform ?? "",
    status: "uploaded",
    step: "排队中",
    errorMessage: "",
    duration: "",
    cover: "",
    groupId: input.groupId ?? null,
    bigCategoryId: null,
    collectionId: null,
    createdAt: now(),
    updatedAt: now(),
  };
  getDb()
    .prepare(
      `INSERT INTO source_assets
       (id,type,title,author,sourceUrl,sourcePlatform,status,step,errorMessage,duration,groupId,bigCategoryId,collectionId,createdAt,updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      asset.id, asset.type, asset.title, asset.author, asset.sourceUrl,
      asset.sourcePlatform, asset.status, asset.step, asset.errorMessage,
      asset.duration, asset.groupId, asset.bigCategoryId, asset.collectionId,
      asset.createdAt, asset.updatedAt
    );
  return asset;
}

export function updateAsset(
  id: string,
  patch: Partial<
    Pick<
      SourceAsset,
      | "title" | "author" | "status" | "step" | "errorMessage" | "duration"
      | "cover" | "bigCategoryId" | "collectionId"
    >
  >
): void {
  const fields = Object.keys(patch) as (keyof typeof patch)[];
  if (!fields.length) return;
  const sets = fields.map((f) => `${f} = ?`).join(", ");
  getDb()
    .prepare(`UPDATE source_assets SET ${sets}, updatedAt = ? WHERE id = ?`)
    .run(...fields.map((f) => patch[f] as string | null), now(), id);
}

export function getAsset(id: string): SourceAsset | null {
  const row = getDb()
    .prepare(`SELECT * FROM source_assets WHERE id = ?`)
    .get(id);
  return (row as unknown as SourceAsset) ?? null;
}

export function getAssetsByGroup(groupId: string): SourceAsset[] {
  const rows = getDb()
    .prepare(`SELECT * FROM source_assets WHERE groupId = ? ORDER BY createdAt`)
    .all(groupId);
  return rows as unknown as SourceAsset[];
}

export function saveTranscript(assetId: string, fullText: string): void {
  getDb()
    .prepare(`INSERT INTO transcripts (id, assetId, fullText, createdAt) VALUES (?,?,?,?)`)
    .run(randomUUID(), assetId, fullText, now());
}

export function getTranscript(assetId: string): string | null {
  const row = getDb()
    .prepare(`SELECT fullText FROM transcripts WHERE assetId = ? ORDER BY createdAt DESC LIMIT 1`)
    .get(assetId) as { fullText: string } | undefined;
  return row?.fullText ?? null;
}

export function saveAnalysis(a: Analysis): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO analyses
       (id, assetId, coreQuestion, videoType, typeConfidence, summary, backbone, takeaways, createdAt)
       VALUES (?,?,?,?,?,?,?,?,?)`
    )
    .run(
      randomUUID(), a.assetId, a.coreQuestion, a.videoType, a.typeConfidence,
      a.summary, JSON.stringify(a.backbone), JSON.stringify(a.takeaways), now()
    );
}

export function saveExpansion(assetId: string, expansion: CognitiveExpansion): void {
  getDb()
    .prepare(`UPDATE analyses SET cognitiveExpansion = ? WHERE assetId = ?`)
    .run(JSON.stringify(expansion), assetId);
}

export function saveEchoes(assetId: string, echoes: StoredEcho[]): void {
  getDb()
    .prepare(`UPDATE analyses SET echoes = ? WHERE assetId = ?`)
    .run(JSON.stringify(echoes), assetId);
}

export function upsertCollection(id: string, name: string, categoryId: string): void {
  getDb()
    .prepare(
      `INSERT INTO collections (id, name, categoryId, createdAt) VALUES (?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, categoryId = excluded.categoryId`
    )
    .run(id, name, categoryId, now());
}

export function getCollectionRow(id: string): CollectionRow | null {
  const row = getDb().prepare(`SELECT * FROM collections WHERE id = ?`).get(id);
  return (row as unknown as CollectionRow) ?? null;
}

/** 有归属（分类完成）的合集，按大类过滤；只返回内含 ≥1 条已解析视频的。 */
export function listCollections(categoryId?: string): CollectionRow[] {
  const where = categoryId ? `AND c.categoryId = ?` : "";
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT c.* FROM collections c
       JOIN source_assets a ON a.collectionId = c.id AND a.status = 'analyzed'
       WHERE 1=1 ${where} ORDER BY c.createdAt`
    )
    .all(...(categoryId ? [categoryId] : []));
  return rows as unknown as CollectionRow[];
}

export function listAssetsByCollection(collectionId: string): SourceAsset[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM source_assets WHERE collectionId = ? AND status = 'analyzed' ORDER BY createdAt`
    )
    .all(collectionId);
  return rows as unknown as SourceAsset[];
}

/** 回响/known 召回基准：全部已解析资产的脉络（排除指定资产自己）。 */
export interface RecallSource {
  assetId: string;
  title: string;
  author: string;
  backbone: BackboneNode[];
}

export function listRecallSources(excludeAssetId: string): RecallSource[] {
  const rows = getDb()
    .prepare(
      `SELECT a.assetId, s.title, s.author, a.backbone FROM analyses a
       JOIN source_assets s ON s.id = a.assetId
       WHERE s.status = 'analyzed' AND a.assetId != ? ORDER BY s.createdAt`
    )
    .all(excludeAssetId) as Record<string, string>[];
  return rows.map((r) => ({
    assetId: r.assetId,
    title: r.title,
    author: r.author,
    backbone: JSON.parse(r.backbone || "[]"),
  }));
}

/** 地图是否已有真实内容（有归属的已解析视频）——有则地图层展示真实数据。 */
export function hasRealMapContent(): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 FROM source_assets WHERE status = 'analyzed' AND collectionId IS NOT NULL LIMIT 1`
    )
    .get();
  return !!row;
}

export function getAnalysis(assetId: string): Analysis | null {
  const row = getDb()
    .prepare(`SELECT * FROM analyses WHERE assetId = ?`)
    .get(assetId) as Record<string, unknown> | undefined;
  if (!row) return null;
  let cognitiveExpansion: CognitiveExpansion | undefined;
  try {
    const raw = row.cognitiveExpansion as string | undefined;
    if (raw) cognitiveExpansion = JSON.parse(raw);
  } catch { /* 坏 JSON 视同未生成 */ }
  let echoes: StoredEcho[] = [];
  try {
    const raw = row.echoes as string | undefined;
    if (raw) echoes = JSON.parse(raw);
  } catch { /* 坏 JSON 视同没有回响 */ }
  return {
    assetId: row.assetId as string,
    coreQuestion: row.coreQuestion as string,
    videoType: row.videoType as string,
    typeConfidence: row.typeConfidence as number,
    summary: row.summary as string,
    backbone: JSON.parse(row.backbone as string),
    takeaways: JSON.parse(row.takeaways as string),
    cognitiveExpansion,
    echoes,
  };
}

/* 解析完成的资产 → 解析页可渲染的形状（脉络节点 = backbone，
   回响按 nodeIndex 挂回节点；认知拓展生成失败时缺席）。 */
export interface ParsedVideo {
  id: string;
  title: string;
  creator: string;
  duration: string;
  cover: string;
  sourceUrl: string;
  collectionId: string | null;
  coreQuestion: string;
  videoType: string;
  typeConfidence: number;
  nodes: { id: string; label: string; role?: string; timestampText: string; detail: string; echo?: Echo }[];
  cognitiveExpansion?: CognitiveExpansion;
}

export function getParsedVideo(id: string): ParsedVideo | null {
  const asset = getAsset(id);
  if (!asset || asset.status !== "analyzed") return null;
  const analysis = getAnalysis(id);
  if (!analysis) return null;
  const echoByIndex = new Map(
    (analysis.echoes ?? []).map(({ nodeIndex, ...echo }) => [nodeIndex, echo])
  );
  return {
    id: asset.id,
    title: asset.title || "未命名视频",
    creator: asset.author,
    duration: asset.duration,
    cover: asset.cover,
    sourceUrl: asset.sourceUrl,
    collectionId: asset.collectionId,
    coreQuestion: analysis.coreQuestion,
    videoType: analysis.videoType,
    typeConfidence: analysis.typeConfidence,
    nodes: analysis.backbone.map((n, i) => ({
      id: n.id || `${asset.id}-n${i + 1}`,
      label: n.concept,
      role: n.role,
      timestampText: n.timestamp,
      detail: n.detail,
      echo: echoByIndex.get(i),
    })),
    cognitiveExpansion: analysis.cognitiveExpansion,
  };
}
